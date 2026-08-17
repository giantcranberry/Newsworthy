"""Postgres lookup cache for media-list journalists (fraction DB)."""

from __future__ import annotations

import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlparse, urlunparse

import psycopg
from psycopg.rows import dict_row

FRESH_DAYS = 60

CONTACT_COLUMNS = [
    "name",
    "name_key",
    "email",
    "email_type",
    "publication",
    "outlet_type",
    "role",
    "theme_fit",
    "example_coverage_url",
    "notes",
    "hunter_email",
    "hunter_score",
    "hunter_verification",
    "hunter_domain",
    "hunter_company",
    "hunter_status",
    "hunter_source_url",
    "source_lists",
]


def normalize_name_key(name: str) -> str:
    cleaned = re.sub(r"\s+", " ", (name or "").strip().lower())
    cleaned = re.sub(r"^(dr|mr|mrs|ms|prof)\.?\s+", "", cleaned)
    return cleaned[:255]


def database_url() -> str | None:
    raw = (
        os.getenv("DIRECT_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("FRACTION_DATABASE_URL")
    )
    if not raw:
        return None
    # Prefer direct/session endpoint; strip pgbouncer query flag for psycopg
    try:
        parsed = urlparse(raw)
        q = "&".join(
            part
            for part in (parsed.query or "").split("&")
            if part and not part.startswith("pgbouncer=") and not part.startswith("connection_limit=")
        )
        host = parsed.hostname or ""
        # Prefer 127.0.0.1 if localhost to avoid IPv6 issues (workspace rule)
        if host == "localhost":
            netloc = parsed.netloc.replace("localhost", "127.0.0.1")
            parsed = parsed._replace(netloc=netloc)
        return urlunparse(parsed._replace(query=q))
    except Exception:
        return raw


def connect() -> psycopg.Connection:
    url = database_url()
    if not url:
        raise RuntimeError(
            "DIRECT_DATABASE_URL or DATABASE_URL is required for journalist lookup cache"
        )
    return psycopg.connect(url, row_factory=dict_row)


def is_fresh(updated_at: datetime | None, *, days: int = FRESH_DAYS) -> bool:
    if not updated_at:
        return False
    if updated_at.tzinfo is None:
        updated_at = updated_at.replace(tzinfo=timezone.utc)
    return updated_at >= datetime.now(timezone.utc) - timedelta(days=days)


def row_to_contact_fields(row: dict[str, Any]) -> dict[str, str]:
    """Map DB row → CSV/Contact field names."""
    return {
        "Journalist": row.get("name") or "",
        "Email": row.get("email") or "",
        "Email_Type": row.get("email_type") or "",
        "Publication": row.get("publication") or "",
        "Outlet_Type": row.get("outlet_type") or "",
        "Role": row.get("role") or "",
        "Theme_Fit": row.get("theme_fit") or "",
        "Example_Coverage_URL": row.get("example_coverage_url") or "",
        "Notes": row.get("notes") or "",
        "Hunter_Email": row.get("hunter_email") or "",
        "Hunter_Score": row.get("hunter_score") or "",
        "Hunter_Verification": row.get("hunter_verification") or "",
        "Hunter_Domain": row.get("hunter_domain") or "",
        "Hunter_Company": row.get("hunter_company") or "",
        "Hunter_Status": row.get("hunter_status") or "",
        "Hunter_Source_URL": row.get("hunter_source_url") or "",
    }


def lookup_journalist(name: str) -> dict[str, Any] | None:
    key = normalize_name_key(name)
    if not key:
        return None
    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT *
                FROM media_list_journalists
                WHERE name_key = %s
                LIMIT 1
                """,
                (key,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "row": row,
        "fresh": is_fresh(row.get("updated_at")),
        "fields": row_to_contact_fields(row),
        "name_key": key,
    }


def _prefer(existing: str | None, new: str | None) -> str | None:
    new_s = (new or "").strip()
    if new_s:
        return new_s
    old_s = (existing or "").strip()
    return old_s or None


def upsert_journalist(
    *,
    name: str,
    email: str = "",
    email_type: str = "",
    publication: str = "",
    outlet_type: str = "",
    role: str = "",
    theme_fit: str = "",
    example_coverage_url: str = "",
    notes: str = "",
    hunter_email: str = "",
    hunter_score: str = "",
    hunter_verification: str = "",
    hunter_domain: str = "",
    hunter_company: str = "",
    hunter_status: str = "",
    hunter_source_url: str = "",
    source_list: str | None = None,
    force_touch: bool = True,
) -> dict[str, Any]:
    """Insert or update one journalist. Always bumps updated_at when force_touch."""
    key = normalize_name_key(name)
    if not key:
        raise ValueError("name is required")

    with connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM media_list_journalists WHERE name_key = %s LIMIT 1",
                (key,),
            )
            existing = cur.fetchone()

            if existing:
                lists = list(existing.get("source_lists") or [])
                if source_list and source_list not in lists:
                    lists.append(source_list)

                values = {
                    "name": name.strip() or existing["name"],
                    "email": _prefer(existing.get("email"), email),
                    "email_type": _prefer(existing.get("email_type"), email_type),
                    "publication": _prefer(existing.get("publication"), publication),
                    "outlet_type": _prefer(existing.get("outlet_type"), outlet_type),
                    "role": _prefer(existing.get("role"), role),
                    "theme_fit": _prefer(existing.get("theme_fit"), theme_fit),
                    "example_coverage_url": _prefer(
                        existing.get("example_coverage_url"), example_coverage_url
                    ),
                    "notes": _prefer(existing.get("notes"), notes),
                    "hunter_email": _prefer(existing.get("hunter_email"), hunter_email),
                    "hunter_score": _prefer(existing.get("hunter_score"), hunter_score),
                    "hunter_verification": _prefer(
                        existing.get("hunter_verification"), hunter_verification
                    ),
                    "hunter_domain": _prefer(existing.get("hunter_domain"), hunter_domain),
                    "hunter_company": _prefer(existing.get("hunter_company"), hunter_company),
                    "hunter_status": _prefer(existing.get("hunter_status"), hunter_status),
                    "hunter_source_url": _prefer(
                        existing.get("hunter_source_url"), hunter_source_url
                    ),
                    "source_lists": lists,
                }
                cur.execute(
                    """
                    UPDATE media_list_journalists SET
                      name = %(name)s,
                      email = %(email)s,
                      email_type = %(email_type)s,
                      publication = %(publication)s,
                      outlet_type = %(outlet_type)s,
                      role = %(role)s,
                      theme_fit = %(theme_fit)s,
                      example_coverage_url = %(example_coverage_url)s,
                      notes = %(notes)s,
                      hunter_email = %(hunter_email)s,
                      hunter_score = %(hunter_score)s,
                      hunter_verification = %(hunter_verification)s,
                      hunter_domain = %(hunter_domain)s,
                      hunter_company = %(hunter_company)s,
                      hunter_status = %(hunter_status)s,
                      hunter_source_url = %(hunter_source_url)s,
                      source_lists = %(source_lists)s,
                      updated_at = CASE WHEN %(force_touch)s THEN now() ELSE updated_at END
                    WHERE name_key = %(name_key)s
                    RETURNING *
                    """,
                    {**values, "name_key": key, "force_touch": force_touch},
                )
                row = cur.fetchone()
                action = "updated"
            else:
                lists = [source_list] if source_list else []
                cur.execute(
                    """
                    INSERT INTO media_list_journalists (
                      name, name_key, email, email_type, publication, outlet_type,
                      role, theme_fit, example_coverage_url, notes,
                      hunter_email, hunter_score, hunter_verification, hunter_domain,
                      hunter_company, hunter_status, hunter_source_url, source_lists
                    ) VALUES (
                      %(name)s, %(name_key)s, %(email)s, %(email_type)s, %(publication)s,
                      %(outlet_type)s, %(role)s, %(theme_fit)s, %(example_coverage_url)s,
                      %(notes)s, %(hunter_email)s, %(hunter_score)s, %(hunter_verification)s,
                      %(hunter_domain)s, %(hunter_company)s, %(hunter_status)s,
                      %(hunter_source_url)s, %(source_lists)s
                    )
                    RETURNING *
                    """,
                    {
                        "name": name.strip(),
                        "name_key": key,
                        "email": email.strip() or None,
                        "email_type": email_type.strip() or None,
                        "publication": publication.strip() or None,
                        "outlet_type": outlet_type.strip() or None,
                        "role": role.strip() or None,
                        "theme_fit": theme_fit.strip() or None,
                        "example_coverage_url": example_coverage_url.strip() or None,
                        "notes": notes.strip() or None,
                        "hunter_email": hunter_email.strip() or None,
                        "hunter_score": hunter_score.strip() or None,
                        "hunter_verification": hunter_verification.strip() or None,
                        "hunter_domain": hunter_domain.strip() or None,
                        "hunter_company": hunter_company.strip() or None,
                        "hunter_status": hunter_status.strip() or None,
                        "hunter_source_url": hunter_source_url.strip() or None,
                        "source_lists": lists,
                    },
                )
                row = cur.fetchone()
                action = "inserted"
        conn.commit()

    return {"action": action, "row": row, "fields": row_to_contact_fields(row), "fresh": True}


def upsert_from_contact(contact: Any, *, source_list: str | None = None) -> dict[str, Any]:
    """Upsert from a Contact model or dict with CSV field names."""
    data = contact.model_dump() if hasattr(contact, "model_dump") else dict(contact)
    return upsert_journalist(
        name=data.get("Journalist") or "",
        email=data.get("Email") or "",
        email_type=data.get("Email_Type") or "",
        publication=data.get("Publication") or "",
        outlet_type=data.get("Outlet_Type") or "",
        role=data.get("Role") or "",
        theme_fit=data.get("Theme_Fit") or "",
        example_coverage_url=data.get("Example_Coverage_URL") or "",
        notes=data.get("Notes") or "",
        hunter_email=data.get("Hunter_Email") or "",
        hunter_score=data.get("Hunter_Score") or "",
        hunter_verification=data.get("Hunter_Verification") or "",
        hunter_domain=data.get("Hunter_Domain") or "",
        hunter_company=data.get("Hunter_Company") or "",
        hunter_status=data.get("Hunter_Status") or "",
        hunter_source_url=data.get("Hunter_Source_URL") or "",
        source_list=source_list,
    )


def table_exists() -> bool:
    try:
        with connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = 'media_list_journalists'
                    """
                )
                return cur.fetchone() is not None
    except Exception:
        return False
