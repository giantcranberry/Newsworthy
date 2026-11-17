"""Hunter.io fallback for outlets where publisher pages printed no usable address.

Credits (Starter plan): Domain Search 1 per search that returns results,
Email Finder 1 per address found, Email Verifier 0.5. Email Count and
Account are free. Every response is cached under the work directory, so a
re-run doesn't pay twice; Hunter also doesn't charge for repeating a search in
the same billing period.

Rules:
- Only editorial people (editor, reporter, writer, producer, host, ...) or a
  news desk inbox are considered.
- An address is kept only when Hunter's verification is "valid": either a
  verification Hunter made in the last VERIFIED_FRESH_DAYS days, or a fresh
  Email Verifier call.
- found_only=True keeps only addresses Hunter saw published on the web.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import httpx

from media_lists.emails import local_block_reason

API = "https://api.hunter.io/v2"
REPO_ROOT = Path(__file__).resolve().parents[3]
VERIFIED_FRESH_DAYS = 90

# Higher is better. A title must score > 0 to count as editorial.
TITLE_RANK = [
    (re.compile(r"\b(editor[- ]in[- ]chief|executive editor|managing editor|news editor)\b", re.I), 6),
    (re.compile(r"\b(senior|deputy|associate|features?|section|contributing)?\s*editor\b", re.I), 5),
    (re.compile(r"\b(reporter|journalist|correspondent|columnist|writer|critic)\b", re.I), 4),
    (re.compile(r"\b(producer|host|anchor|podcast|newsletter)\b", re.I), 3),
    (re.compile(r"\b(editorial|newsroom|news|content director)\b", re.I), 2),
]
NOT_EDITORIAL = re.compile(
    r"\b(sales|advertis\w*|account (executive|manager)|marketing|business development|partnerships?|"
    r"circulation|subscriptions?|events?|finance|hr|human resources|recruit\w*|engineer\w*|developer|"
    r"legal|counsel|operations|it\b|ad ops)\b",
    re.I,
)
DESK_LOCALS = {"news", "newsdesk", "editor", "editors", "editorial", "tips", "newstips", "pitches",
               "submissions", "press", "newsroom", "stories", "story"}


class BudgetExceeded(RuntimeError):
    pass


def api_key() -> str:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)
    for name in (".env.local", ".env"):
        load_dotenv(REPO_ROOT / name, override=False)
    return (os.getenv("HUNTER_API_KEY") or os.getenv("HUNTER_IO_API") or "").strip()


def title_rank(title: str) -> int:
    if not title or NOT_EDITORIAL.search(title):
        return 0
    return max((score for pattern, score in TITLE_RANK if pattern.search(title)), default=0)


@dataclass
class HunterContact:
    email: str
    name: str
    position: str
    kind: str  # "personal" | "generic"
    confidence: int
    verification: str  # Hunter's last status, "" if none
    verified_on: str  # YYYY-MM-DD, "" if none
    sources: list[str] = field(default_factory=list)

    @property
    def found(self) -> bool:
        """Hunter saw this address published somewhere (not just pattern-inferred)."""
        return bool(self.sources)

    @property
    def rank(self) -> int:
        if self.kind == "generic":
            return 1 if self.email.split("@", 1)[0].lower() in DESK_LOCALS else 0
        return title_rank(self.position)

    def freshly_valid(self, today: date | None = None) -> bool:
        if self.verification != "valid" or not self.verified_on:
            return False
        try:
            checked = date.fromisoformat(self.verified_on[:10])
        except ValueError:
            return False
        return (today or date.today()) - checked <= timedelta(days=VERIFIED_FRESH_DAYS)


class Hunter:
    def __init__(self, key: str, *, cache_dir: Path, budget: float, timeout: float = 30) -> None:
        if not key:
            raise RuntimeError("Set HUNTER_API_KEY in the repo root .env.local")
        self.key = key
        self.cache_dir = cache_dir
        self.budget = budget
        self.spent = 0.0
        self.calls = 0
        self.client = httpx.Client(timeout=timeout)

    def close(self) -> None:
        self.client.close()

    # -- transport ---------------------------------------------------------
    def _cache_file(self, path: str, params: dict) -> Path:
        digest = hashlib.sha256(json.dumps([path, params], sort_keys=True).encode()).hexdigest()[:24]
        return self.cache_dir / f"{path.replace('/', '_')}-{digest}.json"

    def _get(self, path: str, params: dict, *, cost: float) -> dict:
        cached = self._cache_file(path, params)
        if cached.exists():
            return json.loads(cached.read_text(encoding="utf-8"))
        if cost and self.spent + cost > self.budget:
            raise BudgetExceeded(f"Hunter budget of {self.budget:g} credits reached")
        resp = self.client.get(f"{API}/{path}", params={**params, "api_key": self.key})
        self.calls += 1
        self.spent += float(resp.headers.get("x-credits-used") or 0)
        if resp.status_code == 202:  # verifier still running; treat as unknown
            return {"data": {"status": "unknown"}}
        if resp.status_code >= 400:
            errors = resp.json().get("errors") if resp.headers.get("content-type", "").startswith("application/json") else None
            detail = (errors or [{}])[0].get("details") or resp.text[:200]
            if resp.status_code in (401, 403, 429):
                raise RuntimeError(f"Hunter {path}: {resp.status_code} {detail}")
            return {"data": {}, "errors": errors}
        payload = resp.json()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(payload), encoding="utf-8")
        return payload

    # -- endpoints ---------------------------------------------------------
    def account(self) -> dict:
        resp = self.client.get(f"{API}/account", params={"api_key": self.key})
        resp.raise_for_status()
        return resp.json()["data"]

    def email_count(self, domain: str) -> dict:
        """Free. Totals plus counts by department."""
        return self._get("email-count", {"domain": domain}, cost=0).get("data") or {}

    def domain_search(self, domain: str, *, kind: str, department: str = "", limit: int = 10) -> list[HunterContact]:
        params = {"domain": domain, "type": kind, "limit": limit}
        if department:
            params["department"] = department
        data = self._get("domain-search", params, cost=1).get("data") or {}
        out = []
        for e in data.get("emails") or []:
            email = (e.get("value") or "").strip().lower()
            if "@" not in email:
                continue
            name = " ".join(x for x in (e.get("first_name"), e.get("last_name")) if x)
            verification = e.get("verification") or {}
            out.append(HunterContact(
                email=email,
                name=name,
                position=e.get("position") or "",
                kind=e.get("type") or kind,
                confidence=int(e.get("confidence") or 0),
                verification=verification.get("status") or "",
                verified_on=verification.get("date") or "",
                sources=[s.get("uri") for s in (e.get("sources") or []) if s.get("uri")],
            ))
        return out

    def email_finder(self, domain: str, first_name: str, last_name: str) -> HunterContact | None:
        data = self._get("email-finder", {"domain": domain, "first_name": first_name, "last_name": last_name}, cost=1).get("data") or {}
        email = (data.get("email") or "").lower()
        if "@" not in email:
            return None
        verification = data.get("verification") or {}
        return HunterContact(
            email=email,
            name=f"{first_name} {last_name}".strip(),
            position=data.get("position") or "",
            kind="personal",
            confidence=int(data.get("score") or 0),
            verification=verification.get("status") or "",
            verified_on=verification.get("date") or "",
            sources=[s.get("uri") for s in (data.get("sources") or []) if s.get("uri")],
        )

    def verify(self, email: str) -> str:
        data = self._get("email-verifier", {"email": email}, cost=0.5).get("data") or {}
        return data.get("status") or "unknown"

    # -- helpers -----------------------------------------------------------
    def editorial_contacts(
        self, domain: str, *, found_only: bool, limit: int = 5, include_generic: bool = True
    ) -> list[HunterContact]:
        """Best editorial people at an outlet; optionally falls back to a news-desk inbox."""
        people = [
            c for c in self.domain_search(domain, kind="personal", department="communication")
            if c.rank > 0 and not local_block_reason(c.email) and (c.found or not found_only)
        ]
        if not people and include_generic:
            people = [
                c for c in self.domain_search(domain, kind="generic")
                if c.rank > 0 and not local_block_reason(c.email) and (c.found or not found_only)
            ]
        people.sort(key=lambda c: (c.rank, c.freshly_valid(), c.confidence), reverse=True)
        return people[:limit]

    def confirm_valid(self, contact: HunterContact) -> bool:
        """True if the address is verified valid (recent Hunter check, or a new 0.5-credit verification)."""
        if contact.freshly_valid():
            return True
        status = self.verify(contact.email)
        contact.verification = status
        contact.verified_on = date.today().isoformat()
        return status == "valid"
