"""Use Hunter.io to fill and strengthen the pitch list after the publisher crawl.

Targets, in priority order:
- gap:    a planned outlet where the crawl kept nobody
- desk:   an outlet where the crawl kept only a desk inbox; a better-fitting
          named reporter replaces the desk
- deepen: an outlet with a named contact and a free slot (a second beat)
- new:    extra outlets proposed when the list is still short (no crawl)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import urlsplit

from media_lists.hunter import HunterContact
from media_lists.schema import Decision, PagePlan, flat, is_aggregator
from media_lists.select import Drop, domain_key

HUNTER_MARK = "https://hunter.io/search/"
KIND_ORDER = {"gap": 0, "desk": 1, "deepen": 2, "new": 3}


@dataclass
class Target:
    outlet: str
    domain: str
    publication_url: str
    why: str
    kind: str  # gap | desk | deepen | new
    slots: int
    desk_email: str = ""
    already: list[str] = field(default_factory=list)  # titles already on the list here

    @property
    def wants_generic(self) -> bool:
        """A desk inbox is only worth finding where we have nobody at all."""
        return self.kind in ("gap", "new")


def is_hunter_row(row: dict) -> bool:
    return (row.get("email_published_on") or "").startswith(HUNTER_MARK)


def _home(source: str, domain: str) -> str:
    parts = urlsplit(source)
    return f"{parts.scheme or 'https'}://{parts.netloc or domain}/"


def build_targets(
    plans: list[PagePlan],
    rows: list[dict],
    *,
    company_domains: set[str],
    newsroom_host: str,
    max_per_outlet: int,
    kind_for_new: str = "gap",
    skip_domains: set[str] = frozenset(),
) -> list[Target]:
    """Hunter targets from planned outlets and the rows kept so far."""
    blocked = {domain_key(d) for d in company_domains if domain_key(d)} | {newsroom_host}
    on_list: dict[str, list[dict]] = {}
    names_on_list: set[str] = set()
    for row in rows:
        domain = domain_key(row.get("publication_url", "")) or domain_key(row.get("email", ""))
        if domain:
            on_list.setdefault(domain, []).append(row)
        names_on_list.add(flat(row.get("outlet", "")).casefold())

    targets: list[Target] = []
    seen: set[str] = set(skip_domains)
    for plan in plans:
        source = plan.publication_url if plan.publication_url.startswith("http") else plan.url
        domain = domain_key(source)
        outlet = flat(plan.outlet)
        if not domain or not outlet or domain in seen or domain in on_list:
            continue  # outlets already on the list are handled below
        seen.add(domain)
        if domain in blocked or is_aggregator(source) or outlet.casefold() in names_on_list:
            continue
        targets.append(Target(outlet, domain, _home(source, domain), flat(plan.why), kind_for_new, max_per_outlet))

    for domain, kept in on_list.items():
        if domain in seen or domain in blocked:
            continue
        seen.add(domain)
        named = [r for r in kept if r.get("contact_type") == "named"]
        desks = [r for r in kept if r.get("contact_type") != "named"]
        first = kept[0]
        common = dict(
            outlet=flat(first.get("outlet", "")),
            domain=domain,
            publication_url=first.get("publication_url") or f"https://{domain}/",
            why=flat(first.get("why_this_contact", "")),
            already=[flat(r.get("title", "")) for r in named],
        )
        if not named and desks:
            targets.append(Target(kind="desk", slots=max_per_outlet, desk_email=desks[0]["email"], **common))
        elif 0 < len(named) < max_per_outlet:
            targets.append(Target(kind="deepen", slots=max_per_outlet - len(named), **common))

    targets.sort(key=lambda t: KIND_ORDER[t.kind])  # stable: plan order within a kind
    return targets


def candidates_payload(targets: list[Target], candidates: dict[str, list[HunterContact]]) -> list[dict]:
    return [
        {
            "outlet": t.outlet,
            "domain": t.domain,
            "publication_url": t.publication_url,
            "why_this_outlet": t.why,
            "slots": t.slots,
            "current_desk_inbox": t.desk_email,
            "already_on_list": t.already,
            "candidates": [
                {
                    "name": c.name or "(desk inbox)",
                    "position": c.position,
                    "email": c.email,
                    "kind": c.kind,
                    "confidence": c.confidence,
                    "source_pages": c.sources[:3],
                }
                for c in candidates[t.domain]
            ],
        }
        for t in targets
        if candidates.get(t.domain)
    ]


@dataclass
class FillResult:
    rows: list[dict]
    replaced_desks: set[str]
    dropped: list[Drop]


def build_rows(
    decisions: list[Decision],
    targets: list[Target],
    candidates: dict[str, list[HunterContact]],
    *,
    existing_emails: set[str],
    exclude_emails: set[str],
    confirm_valid,
) -> FillResult:
    """Validate the model's picks against Hunter's candidates and build CSV rows.

    confirm_valid(contact) -> bool may spend verifier credits; it runs only for
    a pick that passed every other check.
    """
    target_by_domain = {t.domain: t for t in targets}
    by_email: dict[str, tuple[Target, HunterContact]] = {}
    for domain, contacts in candidates.items():
        if domain in target_by_domain:
            for contact in contacts:
                by_email[contact.email.casefold()] = (target_by_domain[domain], contact)

    excluded = {e.casefold() for e in exclude_emails}
    taken = {e.casefold() for e in existing_emails}
    used: dict[str, int] = {}
    rows: list[dict] = []
    replaced: set[str] = set()
    dropped: list[Drop] = []

    # Best fits first, so slots go to the strongest picks.
    for decision in sorted(decisions, key=lambda d: -int(d.fit or 0)):
        email = flat(decision.email).casefold()
        if not decision.keep:
            if decision.outlet or email:
                dropped.append(Drop(flat(decision.outlet), email, f"hunter: {decision.reason or 'model dropped'}"))
            continue
        match = by_email.get(email)
        if match is None:
            dropped.append(Drop(flat(decision.outlet), email, "hunter: address was not one of Hunter's candidates"))
            continue
        target, contact = match
        if email in taken:
            dropped.append(Drop(target.outlet, email, "hunter: duplicate address"))
            continue
        general = contact.kind == "generic"
        if target.desk_email and general:
            dropped.append(Drop(target.outlet, email, "hunter: outlet already has a desk inbox"))
            continue
        if used.get(target.domain, 0) >= target.slots:
            dropped.append(Drop(target.outlet, email, "hunter: no free slot at this outlet"))
            continue
        if email in excluded:
            dropped.append(Drop(target.outlet, email, "client PR contact"))
            continue
        pitch_angle = flat(decision.pitch_angle)
        why = flat(decision.why_this_contact)
        if not pitch_angle or not why:
            dropped.append(Drop(target.outlet, email, "hunter: missing pitch_angle or why_this_contact"))
            continue
        if not confirm_valid(contact):
            dropped.append(Drop(target.outlet, email, f"hunter: verification {contact.verification or 'failed'}"))
            continue

        source = flat(decision.source_url)
        if source not in contact.sources and source != target.publication_url:
            source = contact.sources[0] if contact.sources else target.publication_url
        provenance = "seen published" if contact.found else "pattern-inferred"
        notes = (
            f"Hunter.io: {provenance}, verified {contact.verification} {contact.verified_on[:10]}, "
            f"confidence {contact.confidence}"
        )
        if target.desk_email:
            notes += f". Replaces desk inbox {target.desk_email}"
            replaced.add(target.desk_email.casefold())
        if flat(decision.notes):
            notes += f". {flat(decision.notes)}"
        rows.append({
            "outlet": target.outlet,
            "publication_url": target.publication_url,
            "contact_name": flat(decision.contact_name) or ("News desk" if general else contact.name) or "News desk",
            "title": flat(decision.title) or contact.position or ("News desk" if general else "Editor"),
            "email": contact.email,
            "contact_type": "general" if general else "named",
            "beat": flat(decision.beat),
            "geography": flat(decision.geography),
            "pitch_angle": pitch_angle,
            "why_this_contact": why,
            "source_url": source,
            "email_published_on": f"{HUNTER_MARK}{target.domain}",
            "notes": notes,
            "_fit": max(1, min(5, int(decision.fit or 3))),
        })
        used[target.domain] = used.get(target.domain, 0) + 1
        taken.add(email)
    return FillResult(rows, replaced, dropped)
