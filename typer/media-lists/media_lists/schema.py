"""Shared shapes for the pitch list."""

from __future__ import annotations

import re
from urllib.parse import urlsplit

from pydantic import BaseModel, Field

COLUMNS = [
    "outlet",
    "publication_url",
    "contact_name",
    "title",
    "email",
    "contact_type",
    "beat",
    "geography",
    "pitch_angle",
    "why_this_contact",
    "source_url",
    "email_published_on",
    "notes",
]

# People-search and media-database hosts are not sources of record.
AGGREGATOR_HOSTS = (
    "muckrack.com",
    "zoominfo.com",
    "rocketreach.co",
    "signalhire.com",
    "contactout.com",
    "hunter.io",
    "apollo.io",
    "lusha.com",
    "prowly.com",
    "journalisthunt.com",
    "sources.com",
    "informedperspectives.org",
    "feedspot.com",
    "konaequity.com",
    "pissedconsumer.com",
    "spokeo.com",
    "whitepages.com",
    "radaris.com",
    "beenverified.com",
    "intelius.com",
    "peekyou.com",
    "aeroleads.com",
    "snov.io",
    "anymailfinder.com",
    "clearbit.com",
    "zoominfo.io",
)

# Inboxes that are not a pitch. General news desks are allowed.
BLOCKED_LOCAL = {
    "sales",
    "advertise",
    "advertising",
    "ads",
    "adsales",
    "subscription",
    "subscriptions",
    "subscribe",
    "subscribers",
    "circulation",
    "circ",
    "jobs",
    "job",
    "careers",
    "career",
    "events",
    "event",
    "privacy",
    "support",
    "legal",
    "reprint",
    "reprints",
    "production",
    "webmaster",
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "billing",
    "accounts",
    "accounting",
}


class Brief(BaseModel):
    client_name: str
    product: str
    dateline: str = ""
    geographies: list[str] = Field(default_factory=list)
    what_it_is: str = ""
    claims_to_use: list[str] = Field(default_factory=list)
    claims_to_avoid: list[str] = Field(default_factory=list)
    exclude_emails: list[str] = Field(default_factory=list)
    exclude_names: list[str] = Field(default_factory=list)
    company_domains: list[str] = Field(default_factory=list)
    beats: list[str] = Field(default_factory=list)
    pitch_notes: str = ""


class PagePlan(BaseModel):
    outlet: str
    publication_url: str
    url: str
    why: str = ""


class Plan(BaseModel):
    pages: list[PagePlan] = Field(default_factory=list)


class Decision(BaseModel):
    keep: bool
    reason: str = ""
    # 1-5: how well this contact fits the brand (5 = covers exactly this story). Used to rank and trim the list.
    fit: int = 3
    outlet: str = ""
    publication_url: str = ""
    contact_name: str = ""
    title: str = ""
    email: str = ""
    contact_type: str = ""
    beat: str = ""
    geography: str = ""
    pitch_angle: str = ""
    why_this_contact: str = ""
    source_url: str = ""
    email_published_on: str = ""
    notes: str = ""


class JudgeResult(BaseModel):
    decisions: list[Decision] = Field(default_factory=list)


def host_of(url: str) -> str:
    host = urlsplit(url.strip()).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host.split(":")[0]


def url_key(url: str) -> str:
    parts = urlsplit(url.strip())
    host = parts.netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    path = parts.path.rstrip("/") or "/"
    return f"{parts.scheme.lower()}://{host}{path}"


def is_aggregator(url: str) -> bool:
    host = host_of(url)
    return any(host == blocked or host.endswith("." + blocked) for blocked in AGGREGATOR_HOSTS)


def flat(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()
