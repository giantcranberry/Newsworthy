"""Run the newsroom-to-CSV process. The model proposes. The script disposes."""

from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock

import httpx
from rich.console import Console

from media_lists.emails import local_block_reason
from media_lists.firecrawl import api_key as firecrawl_key
from media_lists.fetch import (
    UA,
    PageEvidence,
    append_cache,
    fetch_page,
    load_cache,
    search_same_site,
)
from media_lists.llm import Model
from media_lists.usage import USAGE
from media_lists.newsroom import collect_from_database, collect_newsroom
from media_lists.schema import Brief, Decision, PagePlan, Plan, host_of, is_aggregator, url_key
from media_lists.db import store_list
from media_lists.select import Drop, apply_decisions, rank_and_trim, write_csv
from media_lists.hunter import BudgetExceeded, Hunter
from media_lists.hunter_fill import build_rows, build_targets, candidates_payload, is_hunter_row


def _usable_plans(plan: Plan, limit: int) -> list[PagePlan]:
    kept: list[PagePlan] = []
    seen: set[str] = set()
    for page in plan.pages:
        url = page.url.strip()
        if not url.startswith(("http://", "https://")) or "@" in url or is_aggregator(url):
            continue
        key = url_key(url)
        if key in seen:
            continue
        seen.add(key)
        page.url = url
        kept.append(page)
        if len(kept) >= limit:
            break
    return kept


def _editorial(page: PageEvidence) -> list[dict]:
    rows = []
    for item in page.emails:
        if local_block_reason(item.address):
            continue
        rows.append(
            {
                "address": item.address,
                "context": item.context[:240],
                "method": item.method,
            }
        )
        if len(rows) == 6:
            break
    return rows


_UNRESOLVED = re.compile(
    r"ERR_ADDRESS_UNREACHABLE|ERR_NAME_NOT_RESOLVED|Name or service not known|nodename nor servname|"
    r"getaddrinfo|No address associated|Temporary failure in name resolution",
    re.I,
)


def _without_www(url: str) -> str | None:
    """https://www.example.com/x -> https://example.com/x, or None if there's no www."""
    match = re.match(r"^(https?://)www\.(.+)$", url, re.I)
    return f"{match.group(1)}{match.group(2)}" if match else None


def _chunks(items: list, size: int) -> list[list]:
    return [items[index : index + size] for index in range(0, len(items), size)]


class Runner:
    def __init__(
        self,
        *,
        model: Model,
        work: Path,
        out: Path | None,
        chromium: str | None,
        use_chromium: bool,
        use_search: bool,
        use_firecrawl: bool,
        recheck: bool,
        refresh: bool,
        workers: int,
        timeout: float,
        min_rows: int,
        max_rows: int,
        max_pages: int,
        db: Path | None = None,
        console: Console | None = None,
        hunter: Hunter | None = None,
        hunter_found_only: bool = False,
        hunter_preview: bool = False,
        newsroom_from_db: bool = True,
        max_per_outlet: int = 2,
    ) -> None:
        self.model = model
        self.work = work
        self.out = out
        self.chromium = chromium
        self.use_chromium = use_chromium
        self.use_search = use_search
        self.use_firecrawl = use_firecrawl
        self.recheck = recheck
        self.refresh = refresh
        self.workers = max(1, workers)
        self.timeout = timeout
        self.min_rows = min_rows
        self.max_rows = max_rows
        self.max_pages = max_pages
        self.db = db
        self.console = console or Console()
        self.cache_path = work / "pages.jsonl"
        self.hunter = hunter
        self.hunter_found_only = hunter_found_only
        self.hunter_preview = hunter_preview
        self.hunter_report: dict = {}
        self.newsroom_from_db = newsroom_from_db
        self.max_per_outlet = max(1, max_per_outlet)
        self._lock = Lock()

    def run(self, newsroom_url: str) -> tuple[list[dict[str, str]], list[Drop]]:
        self.work.mkdir(parents=True, exist_ok=True)
        text = None
        if self.newsroom_from_db:
            try:
                text = collect_from_database(newsroom_url)
            except Exception as exc:  # DB unreachable, missing env, ...
                self.console.print(f"Could not read the newsroom from the database ({exc}); crawling instead")
            if text:
                self.console.print(f"Read {newsroom_url} from the releases database")
        if not text:
            self.console.print(f"Reading {newsroom_url}")
            text, _home = collect_newsroom(
                newsroom_url,
                chromium=self.chromium,
                use_chromium=self.use_chromium,
                timeout=self.timeout,
            )
        (self.work / "newsroom.txt").write_text(text, encoding="utf-8")
        brief = self.model.brief(text)
        (self.work / "brief.json").write_text(brief.model_dump_json(indent=2), encoding="utf-8")
        self.console.print(f"Brief: {brief.client_name} / {brief.product}")

        target = min(self.max_pages, max(self.min_rows + 30, 60))
        plans = _usable_plans(self.model.plan(brief, target_pages=target), self.max_pages)
        self._save_plan("plan.json", plans)
        self.console.print(f"Crawling {len(plans)} publisher pages")
        pages = self._crawl(plans)
        if self.use_search:
            extra = self._search_gaps(plans, pages)
            if extra:
                self.console.print(f"Search found {len(extra)} more pages on those sites")
                pages.extend(self._crawl(extra))
                plans.extend(extra)

        decisions = self._judge(brief, plans, pages)
        rows, dropped = self._filter(newsroom_url, brief, pages, decisions)
        if len(rows) < self.min_rows:
            already = [page.url for page in plans]
            more = _usable_plans(
                self.model.plan_more(brief, kept=len(rows), minimum=self.min_rows, already=already),
                25,
            )
            known = {url_key(item.url) for item in plans}
            more = [page for page in more if url_key(page.url) not in known]
            if more:
                self.console.print(f"Short of {self.min_rows}. Crawling {len(more)} more pages, then stopping.")
                self._save_plan("plan-more.json", more)
                extra_pages = self._crawl(more)
                pages.extend(extra_pages)
                plans.extend(more)
                decisions.extend(self._judge(brief, more, extra_pages))
                rows, dropped = self._filter(newsroom_url, brief, pages, decisions)

        if self.recheck and rows:
            rows, recheck_drops = self._recheck(rows)
            dropped.extend(recheck_drops)

        if self.hunter is not None:
            rows, hunter_drops = self._hunter_fill(newsroom_url, brief, plans, rows)
            dropped.extend(hunter_drops)

        # Keep the best max_rows by fit.
        ranked = rank_and_trim(rows, self.max_rows)
        trimmed = {id(r) for r in ranked}
        dropped.extend(Drop(r["outlet"], r["email"], f"ranked below the top {self.max_rows} (fit {r.get('_fit')})")
                       for r in rows if id(r) not in trimmed)
        rows = ranked

        if self.out is not None:
            write_csv(self.out, rows)
        if self.db is not None and rows:
            store_list(
                self.db,
                newsroom_url=newsroom_url,
                client_name=brief.client_name,
                csv_path=str(self.out.resolve()) if self.out is not None else "",
                rows=rows,
            )
            self.console.print(f"Saved {len(rows)} contacts in {self.db}")
        self._report(newsroom_url, rows, dropped, pages)
        return rows, dropped

    def _judge(self, brief: Brief, plans: list[PagePlan], pages: list[PageEvidence]) -> list[Decision]:
        hints = {url_key(plan.url): plan.outlet for plan in plans}
        payload = []
        for page in pages:
            emails = _editorial(page)
            if not emails:
                continue
            url = page.final_url or page.url
            payload.append(
                {
                    "outlet_hint": hints.get(url_key(page.url)) or hints.get(url_key(url), ""),
                    "url": url,
                    "title": page.title,
                    "emails": emails,
                }
            )
        decisions: list[Decision] = []
        for number, batch in enumerate(_chunks(payload, 8), start=1):
            self.console.print(f"Judging batch {number}")
            decisions.extend(
                self.model.judge(brief, batch, minimum=self.min_rows, maximum=self.max_rows).decisions
            )
        return decisions

    def _filter(self, newsroom_url, brief: Brief, pages, decisions: list[Decision]):
        (self.work / "decisions.json").write_text(
            json.dumps([item.model_dump() for item in decisions], indent=2),
            encoding="utf-8",
        )
        return apply_decisions(
            decisions,
            pages,
            exclude_emails=set(brief.exclude_emails),
            company_domains=set(brief.company_domains),
            newsroom_host=host_of(newsroom_url),
            max_rows=self.max_rows * 2,  # rank_and_trim keeps the best max_rows at the end
            max_per_outlet=self.max_per_outlet,
        )

    def _crawl(self, plans: list[PagePlan]) -> list[PageEvidence]:
        cache = {} if self.refresh else load_cache(self.cache_path)
        ready: list[PageEvidence] = []
        pending: list[str] = []
        for plan in plans:
            cached = cache.get(plan.url)
            cached_ok = cached is not None and not cached.error and (
                bool(cached.emails)
                or (cached.status is not None and 200 <= cached.status < 400)
            )
            if cached_ok:
                ready.append(cached)
            else:
                pending.append(plan.url)
        if not pending:
            return ready
        client = httpx.Client(
            follow_redirects=True,
            timeout=self.timeout,
            headers={"User-Agent": UA},
        )
        fetched: list[PageEvidence] = []
        try:
            with ThreadPoolExecutor(max_workers=self.workers) as pool:
                futures = {pool.submit(self._fetch_one, client, url): url for url in pending}
                for future in as_completed(futures):
                    fetched.append(future.result())
        finally:
            client.close()
        return ready + fetched

    def _fetch_one(self, client: httpx.Client, url: str) -> PageEvidence:
        page = fetch_page(
            url,
            client=client,
            chromium=self.chromium,
            use_chromium=self.use_chromium,
            use_firecrawl=self.use_firecrawl,
            timeout=self.timeout,
        )
        bare = _without_www(url)
        if bare and page.error and not page.emails and _UNRESOLVED.search(page.error):
            # Some sites only answer on the bare domain (e.g. texasbusiness.com).
            retry = fetch_page(
                bare,
                client=client,
                chromium=self.chromium,
                use_chromium=self.use_chromium,
                use_firecrawl=self.use_firecrawl,
                timeout=self.timeout,
            )
            if not retry.error or retry.emails:
                retry.url = url  # keep the planned URL so decisions still match this page
                retry.final_url = retry.final_url or bare
                page = retry
        with self._lock:
            append_cache(self.cache_path, page)
            count = len(_editorial(page))
            status = page.status if page.status is not None else "err"
            detail = page.error or f"{count} editorial"
            self.console.print(f"{status} {url} {detail}", markup=False)
        return page

    def _search_gaps(self, plans: list[PagePlan], pages: list[PageEvidence]) -> list[PagePlan]:
        have = {url_key(page.url) for page in pages if _editorial(page)}
        have.update(url_key(page.final_url) for page in pages if page.final_url and _editorial(page))
        extras: list[PagePlan] = []
        seen = {url_key(plan.url) for plan in plans}
        searched = 0
        searched_hosts: set[str] = set()
        firecrawl_on = self.use_firecrawl and firecrawl_key() is not None
        host_cap = 30 if firecrawl_on else 15
        extra_cap = 40 if firecrawl_on else 30
        for plan in plans:
            if searched >= host_cap or len(extras) >= extra_cap:
                break
            if url_key(plan.url) in have:
                continue
            host = host_of(plan.publication_url or plan.url)
            if not host or host in searched_hosts or is_aggregator(plan.publication_url or plan.url):
                continue
            searched_hosts.add(host)
            searched += 1
            query = f"site:{host} contact editorial email"
            for url in search_same_site(query, host, use_firecrawl=self.use_firecrawl, timeout=self.timeout):
                key = url_key(url)
                if key in seen or is_aggregator(url):
                    continue
                seen.add(key)
                extras.append(
                    PagePlan(
                        outlet=plan.outlet,
                        publication_url=plan.publication_url,
                        url=url,
                        why="search result on the publisher site",
                    )
                )
        return extras

    def _recheck(self, rows: list[dict[str, str]]) -> tuple[list[dict[str, str]], list[Drop]]:
        self.console.print(f"Rechecking {len(rows)} kept pages")
        kept = []
        dropped: list[Drop] = []
        client = httpx.Client(follow_redirects=True, timeout=self.timeout, headers={"User-Agent": UA})
        try:
            for row in rows:
                page = fetch_page(
                    row["email_published_on"],
                    client=client,
                    chromium=self.chromium,
                    use_chromium=self.use_chromium,
                    use_firecrawl=self.use_firecrawl,
                    timeout=self.timeout,
                )
                found = {item.address.casefold() for item in page.emails}
                if row["email"].casefold() in found:
                    kept.append(row)
                else:
                    reason = page.error or "recheck did not find the address on that page"
                    dropped.append(Drop(row["outlet"], row["email"], reason))
        finally:
            client.close()
        return kept, dropped

    def _hunter_fill(self, newsroom_url: str, brief: Brief, plans: list[PagePlan], rows: list[dict]):
        """Hunter.io: fill empty outlets, upgrade desk-only outlets, add second beats,
        and, if the list is still short, search extra outlets the model proposes."""
        assert self.hunter is not None
        common = dict(company_domains=set(brief.company_domains), newsroom_host=host_of(newsroom_url),
                      max_per_outlet=self.max_per_outlet)
        targets = build_targets(plans, rows, **common)
        self.hunter_report = {"preview": self.hunter_preview,
                              "targets": {k: sum(t.kind == k for t in targets) for k in ("gap", "desk", "deepen")}}

        if self.hunter_preview:
            self.console.print(f"Hunter.io preview (free): {len(targets)} outlets to look up")
            counts = []
            for t in targets:
                data = self.hunter.email_count(t.domain)
                comms = (data.get("department") or {}).get("communication", 0)
                counts.append({"outlet": t.outlet, "domain": t.domain, "kind": t.kind,
                               "total": data.get("total", 0), "communication": comms})
                self.console.print(f"  [{t.kind}] {t.outlet} ({t.domain}): {data.get('total', 0)} addresses, {comms} in communication")
            self.hunter_report["email_counts"] = counts
            return rows, []

        self.console.print(
            f"Hunter.io: {len(targets)} outlets to look up (budget {self.hunter.budget:g} credits)"
        )
        rows, dropped = self._hunter_pass(brief, targets, rows, label="pass 1")

        if len(rows) < self.min_rows and self.hunter.spent < self.hunter.budget:
            self.console.print(f"{len(rows)} contacts, short of {self.min_rows}. Asking for more outlets to search on Hunter.io")
            more = _usable_plans(
                self.model.plan_more(brief, kept=len(rows), minimum=self.min_rows,
                                     already=[p.url for p in plans]),
                40,
            )
            self._save_plan("plan-hunter.json", more)
            extra = [t for t in build_targets(more, rows, kind_for_new="new",
                                              skip_domains={t.domain for t in targets}, **common)
                     if t.kind == "new"]
            if extra:
                rows, more_drops = self._hunter_pass(brief, extra, rows, label="new outlets")
                dropped.extend(more_drops)
            self.hunter_report["targets"]["new"] = len(extra)

        self.hunter_report.update({
            "credits_used": self.hunter.spent,
            "api_calls": self.hunter.calls,
            "found_only": self.hunter_found_only,
            "hunter_rows": sum(1 for r in rows if is_hunter_row(r)),
        })
        self.console.print(f"Hunter.io: {self.hunter_report['hunter_rows']} contacts, {self.hunter.spent:g} credits used")
        return rows, dropped

    def _hunter_pass(self, brief: Brief, targets, rows: list[dict], *, label: str):
        assert self.hunter is not None
        candidates = {}
        enough = max(0, self.max_rows - len(rows)) + 10
        for t in targets:
            if len(candidates) >= enough:
                break
            try:
                found = self.hunter.editorial_contacts(
                    t.domain, found_only=self.hunter_found_only, include_generic=t.wants_generic
                )
            except BudgetExceeded as exc:
                self.console.print(f"Hunter.io: {exc}; stopping lookups")
                break
            if found:
                candidates[t.domain] = found
        payload = candidates_payload(targets, candidates)
        decisions: list[Decision] = []
        for number, batch in enumerate(_chunks(payload, 10), start=1):
            self.console.print(f"Judging Hunter.io {label}, batch {number}")
            decisions.extend(self.model.judge_hunter(brief, batch).decisions)
        with (self.work / "hunter-decisions.json").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"pass": label, "decisions": [d.model_dump() for d in decisions]}) + "\n")

        def confirm(contact) -> bool:
            try:
                return self.hunter.confirm_valid(contact)
            except BudgetExceeded:
                contact.verification = "not checked (budget reached)"
                return False

        result = build_rows(decisions, targets, candidates,
                            existing_emails={r["email"] for r in rows},
                            exclude_emails=set(brief.exclude_emails), confirm_valid=confirm)
        kept = [r for r in rows if r["email"].casefold() not in result.replaced_desks]
        self.console.print(
            f"Hunter.io {label}: {len(candidates)} outlets with editorial staff, "
            f"{len(result.rows)} contacts added, {len(result.replaced_desks)} desk inboxes upgraded"
        )
        return kept + result.rows, result.dropped

    def _save_plan(self, name: str, plans: list[PagePlan]) -> None:
        payload = [page.model_dump() for page in plans]
        (self.work / name).write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _report(self, newsroom_url, rows, dropped: list[Drop], pages: list[PageEvidence]) -> None:
        report = {
            "newsroom_url": newsroom_url,
            "rows": len(rows),
            "min_rows": self.min_rows,
            "max_rows": self.max_rows,
            "shortfall": len(rows) < self.min_rows,
            "csv": str(self.out) if self.out is not None else None,
            "model": self.model.config.model,
            "hunter": self.hunter_report or None,
            "cost_estimate": USAGE.estimate(),
            "dropped": [drop.__dict__ for drop in dropped],
            "fetch_errors": [
                {"url": page.url, "error": page.error}
                for page in pages
                if page.error and not page.emails
            ],
        }
        path = self.work / "report.json"
        path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        self.console.print(f"Wrote {len(rows)} rows to {self.out}" if self.out is not None
                           else f"Found {len(rows)} contacts")
        if report["shortfall"]:
            self.console.print(
                f"That is under {self.min_rows}. Nothing was invented to fill the gap. See {path}"
            )
