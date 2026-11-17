"""Publish researched contacts to a brand's Newsworthy Curated media list (Supabase).

The brand is found from the newsroom URL: https://www.newsworthy.ai/newsroom/<slug>
matches company.nr_uri = <slug>.

Writes (one transaction):
- pitch_groups: the brand's curated list (is_curated = true), created if missing
- curated_journalists: one row per email address, shared across brands
- curated_list_members: links journalists to the brand's curated list

Run offline, per customer request, once the brand has at least
MIN_DISTRIBUTED_RELEASES distributed press releases (releases.status = 'sent').

Contacts without an email are never published. Nothing here touches crm_contacts,
the brand's user lists, or the Share list.
"""

from __future__ import annotations

import hashlib
import os
import re
import sqlite3
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

CURATED_LIST_NAME = "Newsworthy Curated"
HUNTER_MARK = "https://hunter.io/search/"  # email_published_on marker for Hunter.io rows
MIN_DISTRIBUTED_RELEASES = 3
REPO_ROOT = Path(__file__).resolve().parents[3]


@dataclass
class CuratedContact:
    name: str
    email: str
    publication: str
    outlet_domain: str
    role: str
    notes: str
    example_coverage_url: str
    theme_fit: str
    email_source: str = "published"  # 'published' (publisher page) | 'hunter'
    hunter_score: int | None = None
    hunter_verification: str | None = None

    @property
    def email_md5(self) -> str:
        return hashlib.md5(self.email.lower().encode()).hexdigest()


@dataclass
class PublishResult:
    company_id: int
    company_name: str
    distributed_releases: int
    list_id: int
    list_created: bool
    contacts: int
    new_journalists: int = 0
    added_to_list: int = 0
    pruned: int = 0
    skipped: list[str] = field(default_factory=list)


class NotEligible(LookupError):
    """The brand hasn't distributed enough press releases for a curated list yet."""


def newsroom_slug(newsroom_url: str) -> str:
    """https://www.newsworthy.ai/newsroom/green-choice-proteins -> green-choice-proteins"""
    parts = [p for p in urlsplit(newsroom_url).path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "newsroom":
        return parts[1].lower()
    raise ValueError(f"Not a Newsworthy newsroom URL: {newsroom_url}")


def _norm_newsroom(url: str) -> str:
    try:
        return newsroom_slug(url)
    except ValueError:
        return url.rstrip("/").lower()


def database_url() -> str:
    """Supabase connection from the repo root env (session pooler preferred)."""
    from dotenv import load_dotenv

    for name in (".env.local", ".env"):
        load_dotenv(REPO_ROOT / name, override=False)
    raw = os.getenv("DIRECT_DATABASE_URL") or os.getenv("DATABASE_URL") or ""
    if not raw:
        raise RuntimeError("Set DIRECT_DATABASE_URL (repo root .env.local) to the Supabase connection string")
    parts = urlsplit(raw)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in ("pgbouncer", "connection_limit")]
    return urlunsplit(parts._replace(query=urlencode(query)))


def _domain(url: str) -> str:
    host = urlsplit(url).hostname or ""
    return host.removeprefix("www.")[:128]


def load_contacts(sqlite_path: Path, newsroom_url: str) -> tuple[str, list[CuratedContact]]:
    """All contacts on every stored list for this newsroom, one per email."""
    slug = _norm_newsroom(newsroom_url)
    conn = sqlite3.connect(sqlite_path)
    conn.row_factory = sqlite3.Row
    try:
        lists = [r for r in conn.execute("SELECT id, newsroom_url, client_name FROM lists") if _norm_newsroom(r["newsroom_url"]) == slug]
        if not lists:
            raise LookupError(f"No stored list for {newsroom_url} in {sqlite_path}")
        client = next((r["client_name"] for r in lists if r["client_name"]), "")
        rows = conn.execute(
            f"""
            SELECT c.contact_name, c.title, c.email, c.beat, c.source_url, c.email_published_on, c.notes,
                   o.name AS outlet, o.publication_url, lc.pitch_angle, lc.why_this_contact
            FROM list_contacts lc
            JOIN contacts c ON c.id = lc.contact_id
            JOIN outlets o ON o.id = c.outlet_id
            WHERE lc.list_id IN ({",".join("?" * len(lists))})
            ORDER BY lc.list_id DESC
            """,
            [r["id"] for r in lists],
        ).fetchall()
    finally:
        conn.close()

    seen: set[str] = set()
    out: list[CuratedContact] = []
    for r in rows:
        email = (r["email"] or "").strip().lower()
        if "@" not in email or email in seen:
            continue
        seen.add(email)
        theme = " ".join(x for x in (r["pitch_angle"], r["why_this_contact"]) if x)
        from_hunter = (r["email_published_on"] or "").startswith(HUNTER_MARK)
        notes = r["notes"] or ""
        score = re.search(r"confidence (\d+)", notes) if from_hunter else None
        verified = re.search(r"verified (\w+)", notes) if from_hunter else None
        out.append(CuratedContact(
            name=(r["contact_name"] or "").strip() or f"{r['outlet']} newsroom",
            email=email,
            publication=r["outlet"] or "",
            outlet_domain=_domain(r["publication_url"] or "") or email.split("@", 1)[1],
            role=r["title"] or "",
            notes=r["beat"] or "",
            example_coverage_url=(r["source_url"] if from_hunter else r["email_published_on"] or r["source_url"]) or "",
            theme_fit=theme,
            email_source="hunter" if from_hunter else "published",
            hunter_score=int(score.group(1)) if score else None,
            hunter_verification=verified.group(1) if verified else None,
        ))
    return client, out


def check_eligible(newsroom_url: str, *, db_url: str) -> tuple[str, int]:
    """Read-only pre-check: (brand name, distributed releases). Raises if the brand
    is missing or has fewer than MIN_DISTRIBUTED_RELEASES."""
    import psycopg

    slug = newsroom_slug(newsroom_url)
    with psycopg.connect(db_url, autocommit=True, prepare_threshold=None) as conn:
        conn.read_only = True
        companies = conn.execute(
            """
            SELECT c.company_name,
                   (SELECT count(*) FROM releases r
                    WHERE r.company_id = c.id AND r.status = 'sent' AND r.is_deleted IS NOT TRUE)
            FROM company c WHERE lower(c.nr_uri) = %s AND c.is_deleted IS NOT TRUE
            """,
            (slug,),
        ).fetchall()
    if not companies:
        raise LookupError(f"No brand with newsroom '{slug}' (company.nr_uri)")
    if len(companies) > 1:
        raise LookupError(f"{len(companies)} brands share newsroom '{slug}'; fix company.nr_uri first")
    name, distributed = companies[0]
    if distributed < MIN_DISTRIBUTED_RELEASES:
        raise NotEligible(
            f"{name} has {distributed} distributed press release(s); "
            f"a Newsworthy Curated list needs at least {MIN_DISTRIBUTED_RELEASES}. Use --force to override."
        )
    return name, distributed


def publish(
    newsroom_url: str,
    contacts: list[CuratedContact],
    *,
    db_url: str,
    prune: bool = False,
    dry_run: bool = False,
    force: bool = False,
) -> PublishResult:
    import psycopg

    slug = newsroom_slug(newsroom_url)
    with psycopg.connect(db_url, autocommit=True, prepare_threshold=None) as conn:
        with conn.transaction(force_rollback=dry_run):
            companies = conn.execute(
                "SELECT id, user_id, company_name FROM company WHERE lower(nr_uri) = %s AND is_deleted IS NOT TRUE",
                (slug,),
            ).fetchall()
            if not companies:
                raise LookupError(f"No brand with newsroom '{slug}' (company.nr_uri)")
            if len(companies) > 1:
                raise LookupError(f"{len(companies)} brands share newsroom '{slug}'; fix company.nr_uri first")
            company_id, user_id, company_name = companies[0]

            distributed = conn.execute(
                "SELECT count(*) FROM releases WHERE company_id = %s AND status = 'sent' AND is_deleted IS NOT TRUE",
                (company_id,),
            ).fetchone()[0]
            if distributed < MIN_DISTRIBUTED_RELEASES and not force:
                raise NotEligible(
                    f"{company_name} has {distributed} distributed press release(s); "
                    f"a Newsworthy Curated list needs at least {MIN_DISTRIBUTED_RELEASES}. Use --force to override."
                )

            row = conn.execute(
                "SELECT id FROM pitch_groups WHERE co_id = %s AND is_curated AND is_deleted IS NOT TRUE",
                (company_id,),
            ).fetchone()
            list_created = row is None
            if row is None:
                row = conn.execute(
                    """
                    INSERT INTO pitch_groups (uuid, user_id, co_id, group_name, is_curated, description, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, true, %s, now(), now())
                    RETURNING id
                    """,
                    (uuid.uuid4().hex, user_id, company_id, CURATED_LIST_NAME,
                     "Journalists researched by Newsworthy for this brand."),
                ).fetchone()
            list_id = row[0]

            result = PublishResult(company_id, company_name, distributed, list_id, list_created, len(contacts))
            journalist_ids: list[int] = []
            for c in contacts:
                jid, inserted = conn.execute(
                    """
                    INSERT INTO curated_journalists (
                        name, email, email_md5, email_source, hunter_score, hunter_verification,
                        publication, outlet_domain, role, example_coverage_url, notes
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (email_md5) DO UPDATE SET
                        name = excluded.name,
                        -- once seen on a publisher page, an address stays 'published'
                        email_source = CASE WHEN curated_journalists.email_source = 'published'
                                            THEN 'published' ELSE excluded.email_source END,
                        hunter_score = coalesce(excluded.hunter_score, curated_journalists.hunter_score),
                        hunter_verification = coalesce(excluded.hunter_verification, curated_journalists.hunter_verification),
                        publication = excluded.publication,
                        outlet_domain = excluded.outlet_domain,
                        role = coalesce(nullif(excluded.role, ''), curated_journalists.role),
                        example_coverage_url = coalesce(nullif(excluded.example_coverage_url, ''), curated_journalists.example_coverage_url),
                        notes = coalesce(nullif(excluded.notes, ''), curated_journalists.notes),
                        updated_at = now()
                    RETURNING id, (xmax = 0)
                    """,
                    (c.name, c.email[:128], c.email_md5, c.email_source, c.hunter_score, c.hunter_verification,
                     c.publication, c.outlet_domain, c.role, c.example_coverage_url, c.notes),
                ).fetchone()
                journalist_ids.append(jid)
                result.new_journalists += int(inserted)

                added = conn.execute(
                    """
                    INSERT INTO curated_list_members (pitch_group_id, curated_journalist_id, theme_fit)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (pitch_group_id, curated_journalist_id) DO UPDATE SET theme_fit = excluded.theme_fit
                    RETURNING (xmax = 0)
                    """,
                    (list_id, jid, c.theme_fit or None),
                ).fetchone()[0]
                result.added_to_list += int(added)

            if prune:
                result.pruned = conn.execute(
                    "DELETE FROM curated_list_members WHERE pitch_group_id = %s AND NOT (curated_journalist_id = ANY(%s))",
                    (list_id, journalist_ids),
                ).rowcount

            conn.execute("UPDATE pitch_groups SET updated_at = now(), latest = now() WHERE id = %s", (list_id,))
    return result
