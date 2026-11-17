"""Keep a model decision only when the address was extracted from that page."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from media_lists.emails import clean_address, local_block_reason
from media_lists.fetch import PageEvidence
from media_lists.schema import COLUMNS, Decision, flat, host_of, is_aggregator, url_key


@dataclass
class Drop:
    outlet: str
    email: str
    reason: str


def index_pages(pages: list[PageEvidence]) -> dict[str, PageEvidence]:
    index: dict[str, PageEvidence] = {}
    for page in pages:
        for url in (page.url, page.final_url):
            if url:
                index[url_key(url)] = page
    return index


def domain_key(value: str) -> str:
    text = (value or "").strip().lower()
    if not text:
        return ""
    text = text.removeprefix("https://").removeprefix("http://").removeprefix("www.")
    return text.split("/")[0].split("?")[0].split("@")[-1].strip(".")


def apply_decisions(
    decisions: list[Decision],
    pages: list[PageEvidence],
    *,
    exclude_emails: set[str],
    company_domains: set[str],
    newsroom_host: str,
    max_rows: int,
    max_per_outlet: int = 1,
) -> tuple[list[dict[str, str]], list[Drop]]:
    index = index_pages(pages)
    excluded = {item.casefold() for item in exclude_emails}
    domains = {domain_key(item) for item in company_domains if domain_key(item)}
    kept: list[dict[str, str]] = []
    dropped: list[Drop] = []
    seen_email: set[str] = set()
    per_outlet: dict[str, int] = {}
    desk_outlets: set[str] = set()

    for decision in decisions:
        outlet = flat(decision.outlet)
        raw_email = flat(decision.email)
        if not decision.keep:
            if outlet or raw_email:
                dropped.append(Drop(outlet, raw_email, decision.reason or "model dropped"))
            continue
        email = clean_address(raw_email)
        if not email:
            dropped.append(Drop(outlet, raw_email, "not a usable address"))
            continue
        blocked = local_block_reason(email)
        if blocked:
            dropped.append(Drop(outlet, email, blocked))
            continue
        if email.casefold() in excluded:
            dropped.append(Drop(outlet, email, "client PR contact"))
            continue
        mail_domain = email.split("@", 1)[1].lower()
        if any(mail_domain == item or mail_domain.endswith("." + item) for item in domains):
            dropped.append(Drop(outlet, email, "address is on the company's own domain"))
            continue
        page = index.get(url_key(decision.email_published_on))
        if page is None:
            dropped.append(Drop(outlet, email, "email_published_on was not a page this run fetched"))
            continue
        page_url = page.final_url or page.url
        if is_aggregator(page_url):
            dropped.append(Drop(outlet, email, "aggregator page"))
            continue
        if host_of(page_url) == newsroom_host:
            dropped.append(Drop(outlet, email, "address is on the newsroom host, not a publisher"))
            continue
        printed = next((item.address for item in page.emails if item.address.casefold() == email.casefold()), "")
        if not printed:
            dropped.append(Drop(outlet, email, "address was not extracted from that page"))
            continue
        if not outlet:
            dropped.append(Drop("", printed, "missing outlet"))
            continue
        outlet_key = outlet.casefold()
        contact_type = flat(decision.contact_type).lower()
        contact_name = flat(decision.contact_name)
        if contact_name.casefold().endswith("desk") or contact_name.casefold() in {"newsroom", "editorial"}:
            contact_type = "general"
        if printed.casefold() in seen_email:
            dropped.append(Drop(outlet, printed, "duplicate address"))
            continue
        # Up to max_per_outlet people per outlet; a desk inbox only when it's the outlet's only contact.
        if per_outlet.get(outlet_key, 0) >= max_per_outlet or outlet_key in desk_outlets or (
            contact_type == "general" and per_outlet.get(outlet_key, 0) > 0
        ):
            dropped.append(Drop(outlet, printed, "duplicate outlet"))
            continue
        if contact_type not in {"named", "general"}:
            dropped.append(Drop(outlet, printed, "contact_type must be named or general"))
            continue
        title = flat(decision.title)
        if not title:
            title = contact_name if contact_type == "general" else "Editor"
        publication = flat(decision.publication_url)
        if not publication.startswith("http"):
            parts = urlsplit(page_url)
            publication = f"{parts.scheme}://{parts.netloc}/"
        source_page = index.get(url_key(decision.source_url))
        source = (source_page.final_url or source_page.url) if source_page else page_url
        row = {
            "outlet": outlet,
            "publication_url": publication,
            "contact_name": contact_name,
            "title": title,
            "email": printed,
            "contact_type": contact_type,
            "beat": flat(decision.beat),
            "geography": flat(decision.geography),
            "pitch_angle": flat(decision.pitch_angle),
            "why_this_contact": flat(decision.why_this_contact),
            "source_url": source,
            "email_published_on": page_url,
            "notes": flat(decision.notes),
            "_fit": max(1, min(5, int(decision.fit or 3))),
        }
        missing = [name for name in COLUMNS if name != "notes" and not row[name]]
        if missing:
            dropped.append(Drop(outlet, printed, "missing " + ", ".join(missing)))
            continue
        per_outlet[outlet_key] = per_outlet.get(outlet_key, 0) + 1
        if contact_type == "general":
            desk_outlets.add(outlet_key)
        seen_email.add(printed.casefold())
        kept.append(row)
        if len(kept) >= max_rows:
            break
    return kept, dropped


def rank_and_trim(rows: list[dict], max_rows: int) -> list[dict]:
    """Best first: higher fit, then named people over desks, then crawled over Hunter. Keep max_rows."""
    def key(item):
        index, row = item
        hunter = (row.get("email_published_on") or "").startswith("https://hunter.io/")
        return (-int(row.get("_fit") or 3), row.get("contact_type") != "named", hunter, index)
    ranked = [row for _, row in sorted(enumerate(rows), key=key)]
    return ranked[:max_rows]


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        # Internal keys such as "_fit" are not written.
        writer = csv.DictWriter(handle, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
