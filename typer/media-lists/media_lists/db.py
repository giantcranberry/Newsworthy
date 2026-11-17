"""SQLite store for outlets, contacts, and the pitch lists that use them."""

from __future__ import annotations

import sqlite3
from pathlib import Path

from media_lists.classify import classify

SCHEMA = """
CREATE TABLE IF NOT EXISTS outlets (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    publication_url TEXT NOT NULL DEFAULT '',
    industry TEXT NOT NULL,
    vertical TEXT NOT NULL,
    section TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY,
    outlet_id INTEGER NOT NULL REFERENCES outlets(id),
    contact_name TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL,
    email_key TEXT NOT NULL,
    contact_type TEXT NOT NULL,
    beat TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    email_published_on TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    UNIQUE (outlet_id, email_key)
);

CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY,
    newsroom_url TEXT NOT NULL,
    client_name TEXT NOT NULL DEFAULT '',
    csv_path TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (newsroom_url, csv_path)
);

CREATE TABLE IF NOT EXISTS list_contacts (
    list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    contact_id INTEGER NOT NULL REFERENCES contacts(id),
    geography TEXT NOT NULL DEFAULT '',
    pitch_angle TEXT NOT NULL DEFAULT '',
    why_this_contact TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (list_id, contact_id)
);

CREATE INDEX IF NOT EXISTS outlets_industry ON outlets (industry, vertical, section);
CREATE INDEX IF NOT EXISTS contacts_email ON contacts (email_key);
"""


def default_db_path() -> Path:
    return Path(__file__).resolve().parents[1] / "media.sqlite"


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def _key(value: str) -> str:
    return " ".join((value or "").casefold().split())


def store_list(
    path: Path,
    *,
    newsroom_url: str,
    client_name: str,
    csv_path: str,
    rows: list[dict[str, str]],
) -> int:
    """Insert or replace one pitch list. The same address is one contact."""
    conn = connect(path)
    try:
        list_id = conn.execute(
            """
            INSERT INTO lists (newsroom_url, client_name, csv_path)
            VALUES (?, ?, ?)
            ON CONFLICT (newsroom_url, csv_path) DO UPDATE SET
                client_name = excluded.client_name,
                created_at = datetime('now')
            RETURNING id
            """,
            (newsroom_url, client_name, csv_path),
        ).fetchone()["id"]
        conn.execute("DELETE FROM list_contacts WHERE list_id = ?", (list_id,))
        for row in rows:
            outlet = (row.get("outlet") or "").strip()
            email = (row.get("email") or "").strip()
            if not outlet or "@" not in email:
                raise ValueError(f"row is missing an outlet or address: {outlet or email or 'blank'}")
            industry, vertical, section = classify(outlet, row.get("beat", ""), row.get("title", ""))
            outlet_id = conn.execute(
                """
                INSERT INTO outlets (name, name_key, publication_url, industry, vertical, section)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (name_key) DO UPDATE SET
                    name = excluded.name,
                    publication_url = excluded.publication_url,
                    industry = excluded.industry,
                    vertical = excluded.vertical,
                    section = excluded.section
                RETURNING id
                """,
                (outlet, _key(outlet), row.get("publication_url", ""), industry, vertical, section),
            ).fetchone()["id"]
            contact_id = conn.execute(
                """
                INSERT INTO contacts (
                    outlet_id, contact_name, title, email, email_key, contact_type,
                    beat, source_url, email_published_on, notes
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (outlet_id, email_key) DO UPDATE SET
                    outlet_id = excluded.outlet_id,
                    contact_name = excluded.contact_name,
                    title = excluded.title,
                    email = excluded.email,
                    contact_type = excluded.contact_type,
                    beat = excluded.beat,
                    source_url = excluded.source_url,
                    email_published_on = excluded.email_published_on,
                    notes = excluded.notes
                RETURNING id
                """,
                (
                    outlet_id,
                    row.get("contact_name", ""),
                    row.get("title", ""),
                    email,
                    email.casefold(),
                    row.get("contact_type", ""),
                    row.get("beat", ""),
                    row.get("source_url", ""),
                    row.get("email_published_on", ""),
                    row.get("notes", ""),
                ),
            ).fetchone()["id"]
            conn.execute(
                """
                INSERT INTO list_contacts (list_id, contact_id, geography, pitch_angle, why_this_contact)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    list_id,
                    contact_id,
                    row.get("geography", ""),
                    row.get("pitch_angle", ""),
                    row.get("why_this_contact", ""),
                ),
            )
        conn.commit()
        return list_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def outlet_rows(
    path: Path,
    *,
    industry: str = "",
    vertical: str = "",
    section: str = "",
) -> list[sqlite3.Row]:
    conn = connect(path)
    try:
        return list(
            conn.execute(
                """
                SELECT o.name, o.publication_url, o.industry, o.vertical, o.section,
                       COUNT(c.id) AS contacts
                FROM outlets o
                LEFT JOIN contacts c ON c.outlet_id = o.id
                WHERE (:industry = '' OR o.industry = :industry)
                  AND (:vertical = '' OR o.vertical = :vertical)
                  AND (:section = '' OR o.section = :section)
                GROUP BY o.id
                ORDER BY o.industry, o.vertical, o.name
                """,
                {"industry": industry, "vertical": vertical, "section": section},
            )
        )
    finally:
        conn.close()
