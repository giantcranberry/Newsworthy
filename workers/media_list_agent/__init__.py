"""Build verified journalist/media lists from Newsworthy newsroom URLs using Grok 4.5 + Firecrawl."""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from .db import (
    FRESH_DAYS,
    lookup_journalist,
    normalize_name_key,
    table_exists as journalist_table_exists,
    upsert_from_contact,
)
from .hunter import HUNTER_FIELDS, enrich_row, hunter_api_key

ROOT = Path(__file__).resolve().parent
WORKERS_ROOT = ROOT.parent
REPO_ROOT = WORKERS_ROOT.parent
LISTS_DIR = WORKERS_ROOT / "lists"

# Load env from workers/.env, then repo .env.local / .env
load_dotenv(WORKERS_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env.local")
load_dotenv(REPO_ROOT / ".env")

CSV_FIELDS = [
    "Journalist",
    "Email",
    "Email_Type",
    "Publication",
    "Outlet_Type",
    "Role",
    "Theme_Fit",
    "Example_Coverage_URL",
    "Notes",
    *HUNTER_FIELDS,
]

SYSTEM_PROMPT = """You are a media-list research agent for Newsworthy.ai brands.

Your job: given a Newsworthy newsroom URL, maintain a verified list of media contacts who cover
themes matching the brand's press releases. You MUST cover all of these audiences — not just
trade reporters:

1) Journalists / editors (trade + consumer)
2) Podcasters / show hosts
3) Bloggers / newsletter writers
4) Influencers / creators (YouTube, Instagram, TikTok, Substack, etc. with verified public identity
   and a real pitch/contact path — skip anonymous handles with no contact page)

Lists live in workers/lists/{newsroom-slug}.csv. If a list already exists, it is preloaded —
treat this as an INCREMENTAL update, not a rebuild.

HARD RULES — never invent:
- Only include people you can verify via scraped bylines, author pages, mastheads, About/Contact pages,
  show notes, channel About pages, or public pitch instructions.
- For the Email column: only include addresses found as mailto:/explicit contact text on crawled pages. Never guess first.last@domain patterns yourself.
- Use lookup_journalist BEFORE spending Firecrawl/Hunter on a named person. If a fresh cache hit
  (updated within 60 days) returns email/hunter data, reuse it via upsert_contact.
- Use hunter_find_email only when lookup_journalist misses or returns stale/empty Hunter fields.
  Hunter results go in Hunter_* fields (do not invent them).
- If a personal email is not found on-page, you may use a published outlet editorial/press desk address and mark Email_Type accordingly.
- Prefer quality and verifiability over volume, but keep digging across trade, consumer, podcasts, blogs, and influencers.
- Include outlet type for every row. Use clear labels such as:
  "Trade", "Consumer magazine", "Podcast", "Blog", "Newsletter", "Influencer / YouTube",
  "Influencer / Instagram", "Podcast + Blog", etc.
- Theme-fit must relate to themes extracted from the newsroom/press releases.
- Do NOT delete existing contacts. Only add new people or fill missing fields (especially Email) on existing ones.

WORKFLOW:
1) Call list_contacts to see who is already on the list (if any). Check coverage gaps across
   journalists, podcasters, bloggers, and influencers.
2) scrape_url the newsroom (and page=2 if pagination exists). Extract brand summary + all press release URLs.
3) scrape_url several key / newest press releases + brand website. Note any NEW themes since prior research.
4) web_search separately for EACH media type still thin on the list, e.g.:
   - "<theme> journalist OR editor OR reporter"
   - "<theme> podcast host"
   - "<theme> blogger OR newsletter"
   - "<theme> YouTube OR influencer OR creator" (fitness/nutrition/supplement-relevant)
5) For each candidate name: call lookup_journalist first. If fresh, upsert_contact with cached fields.
6) Only then scrape_url author/contact/show/channel pages for people not in cache (or stale / missing email).
7) upsert_contact for each verified new person or enrichment.
8) Call hunter_find_email for contacts still missing Hunter_Email after cache+crawl.
9) Before finish: confirm the list has at least some Podcast, Blog/Newsletter, and Influencer rows
   when theme-relevant people exist — do not stop after trade press alone.
10) When done, call finish with a short summary of additions/updates by media type.

Use tools aggressively. Parallelize searches when useful by calling multiple tools in one turn.
Do not finish until you have tried to find emails for contacts still missing them and searched for
net-new outlets across journalists, podcasts, blogs, and influencers.
"""


class Contact(BaseModel):
    Journalist: str
    Email: str = ""
    Email_Type: str = "Not found publicly"
    Publication: str = ""
    Outlet_Type: str = ""
    Role: str = ""
    Theme_Fit: str = ""
    Example_Coverage_URL: str = ""
    Notes: str = ""
    Hunter_Email: str = ""
    Hunter_Score: str = ""
    Hunter_Verification: str = ""
    Hunter_Domain: str = ""
    Hunter_Company: str = ""
    Hunter_Status: str = ""
    Hunter_Source_URL: str = ""


class AgentState(BaseModel):
    newsroom_url: str
    slug: str
    output_path: Path
    brand_summary: str = ""
    themes: list[str] = Field(default_factory=list)
    pr_urls: list[str] = Field(default_factory=list)
    contacts: dict[str, Contact] = Field(default_factory=dict)
    scratch: list[str] = Field(default_factory=list)
    loaded_existing: bool = False
    baseline_count: int = 0
    added_count: int = 0
    updated_count: int = 0

    class Config:
        arbitrary_types_allowed = True


def slug_from_newsroom_url(url: str) -> str:
    path = urlparse(url).path.rstrip("/")
    slug = path.split("/")[-1].strip()
    if not slug:
        raise ValueError(f"Could not derive slug from URL: {url}")
    return slug


def default_list_path(slug: str) -> Path:
    return LISTS_DIR / f"{slug}.csv"


def contact_key(name: str, publication: str) -> str:
    return f"{name.strip().lower()}|{publication.strip().lower()}"


def load_existing_contacts(path: Path) -> dict[str, Contact]:
    """Load contacts from an existing CSV if present."""
    if not path.exists():
        return {}
    contacts: dict[str, Contact] = {}
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            data = {k: (row.get(k) or "").strip() for k in CSV_FIELDS}
            if not data.get("Journalist"):
                continue
            key = contact_key(data["Journalist"], data.get("Publication") or "")
            contacts[key] = Contact(**data)
    return contacts


def apply_hunter_fields(contact: Contact, fields: dict[str, Any], *, force: bool = False) -> bool:
    """Apply Hunter_* fields onto a contact. Returns True if anything changed."""
    changed = False
    for k in HUNTER_FIELDS:
        new_v = str(fields.get(k) or "")
        if not new_v and not force:
            continue
        if getattr(contact, k) != new_v:
            setattr(contact, k, new_v)
            changed = True
    return changed


def apply_cached_fields(contact: Contact, fields: dict[str, str]) -> bool:
    """Fill empty contact fields from a journalist DB cache hit."""
    changed = False
    for k, v in fields.items():
        if k == "Journalist":
            continue
        if not v:
            continue
        cur = getattr(contact, k, "")
        if not cur:
            setattr(contact, k, v)
            changed = True
    return changed


def sync_contacts_to_db(contacts: dict[str, Contact], *, source_list: str | None = None) -> dict[str, int]:
    stats = {"synced": 0, "errors": 0, "skipped": 0}
    if not journalist_table_exists():
        stats["skipped"] = len(contacts)
        return stats
    for contact in contacts.values():
        try:
            upsert_from_contact(contact, source_list=source_list)
            stats["synced"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"  db sync error for {contact.Journalist}: {e}")
    return stats


def enrich_contacts_with_hunter(
    contacts: dict[str, Contact],
    *,
    force: bool = False,
    only_missing_email: bool = False,
) -> dict[str, int]:
    """Run Hunter email finder across contacts. Mutates contacts in place."""
    stats = {
        "attempted": 0,
        "found": 0,
        "not_found": 0,
        "skipped": 0,
        "errors": 0,
        "cached": 0,
        "db_hits": 0,
    }
    if not hunter_api_key():
        print("HUNTER_IO_API not set — skipping Hunter enrichment")
        return stats

    db_ok = journalist_table_exists()

    for contact in contacts.values():
        if only_missing_email and contact.Email:
            stats["skipped"] += 1
            continue
        if contact.Hunter_Email and not force:
            stats["skipped"] += 1
            continue
        if contact.Hunter_Status in {"not_found", "claimed"} and not force:
            stats["skipped"] += 1
            continue

        # Prefer fresh DB cache over spending Hunter credits
        if db_ok and not force:
            try:
                hit = lookup_journalist(contact.Journalist)
            except Exception as e:
                hit = None
                print(f"  db lookup error for {contact.Journalist}: {e}")
            if hit and hit.get("fresh"):
                fields = hit["fields"]
                if fields.get("Hunter_Email") or fields.get("Hunter_Status"):
                    apply_cached_fields(contact, fields)
                    apply_hunter_fields(contact, fields, force=True)
                    stats["db_hits"] += 1
                    if contact.Hunter_Email:
                        stats["found"] += 1
                    else:
                        stats["not_found"] += 1
                    continue

        stats["attempted"] += 1
        print(f"  hunter: {contact.Journalist} @ {contact.Publication[:60]}")
        result = enrich_row(
            journalist=contact.Journalist,
            publication=contact.Publication,
            example_url=contact.Example_Coverage_URL,
            force=force,
            existing_hunter_email=contact.Hunter_Email if not force else "",
        )
        if result.get("skipped") and result.get("Hunter_Status") == "already_set":
            stats["skipped"] += 1
            continue
        if result.get("cached"):
            stats["cached"] += 1
        apply_hunter_fields(contact, result, force=True)
        status = result.get("Hunter_Status") or ""
        if status == "found":
            stats["found"] += 1
        elif status in {"not_found", "claimed", "skipped_no_domain"}:
            stats["not_found"] += 1
        elif status == "error" or result.get("error"):
            stats["errors"] += 1
        else:
            stats["not_found"] += 1
    return stats


def ensure_firecrawl() -> str:
    """Return firecrawl binary path."""
    which = subprocess.run(["which", "firecrawl"], capture_output=True, text=True)
    if which.returncode == 0 and which.stdout.strip():
        return which.stdout.strip()
    # fall back to npx
    return "npx"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def run_firecrawl(args: list[str], timeout: int = 120) -> str:
    bin_path = ensure_firecrawl()
    if bin_path == "npx":
        cmd = ["npx", "-y", "firecrawl", *args]
    else:
        cmd = [bin_path, *args]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "firecrawl failed")
    return proc.stdout


def tool_scrape_url(url: str, only_main: bool = True) -> dict[str, Any]:
    out_dir = WORKERS_ROOT / ".cache" / "firecrawl"
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", urlparse(url).netloc + urlparse(url).path)[:120]
    out_file = out_dir / f"{safe or 'page'}.md"
    args = ["scrape", url, "--wait-for", "2000", "-o", str(out_file)]
    if only_main:
        args.insert(1, "--only-main-content")
        # firecrawl wants flags after scrape url typically: scrape URL --only-main-content
        args = ["scrape", url, "--only-main-content", "--wait-for", "2000", "-o", str(out_file)]
    try:
        run_firecrawl(args)
    except Exception as e:
        return {"ok": False, "url": url, "error": str(e)}
    text = out_file.read_text(errors="ignore") if out_file.exists() else ""
    emails = sorted(set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)))
    emails = [
        e
        for e in emails
        if not any(
            bad in e.lower()
            for bad in ("png", "jpg", "webp", "svg", "w3.org", "example.com", "sentry", "google_")
        )
    ]
    mailtos = sorted(set(re.findall(r"mailto:([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})", text, re.I)))
    # Keep content bounded for the model
    truncated = text[:18000]
    return {
        "ok": True,
        "url": url,
        "path": str(out_file),
        "emails_found": sorted(set(emails + mailtos)),
        "markdown": truncated,
        "chars": len(text),
    }


def tool_web_search(query: str, limit: int = 10) -> dict[str, Any]:
    out_dir = WORKERS_ROOT / ".cache" / "firecrawl"
    out_dir.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "-", query)[:80]
    out_file = out_dir / f"search-{safe}.json"
    args = ["search", query, "--limit", str(limit), "-o", str(out_file), "--json"]
    try:
        run_firecrawl(args, timeout=90)
    except Exception as e:
        return {"ok": False, "query": query, "error": str(e)}
    try:
        data = json.loads(out_file.read_text())
    except Exception as e:
        return {"ok": False, "query": query, "error": f"parse failed: {e}"}
    web = data.get("data", {}).get("web") or data.get("web") or []
    results = [
        {
            "title": r.get("title"),
            "url": r.get("url"),
            "description": r.get("description"),
        }
        for r in web
    ]
    return {"ok": True, "query": query, "results": results, "search_id": data.get("id")}


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "scrape_url",
            "description": "Scrape a URL to markdown via Firecrawl. Returns truncated markdown plus any emails found.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "only_main": {"type": "boolean", "default": True},
                },
                "required": ["url"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Web search via Firecrawl. Discover journalists, podcasters, bloggers, "
                "newsletter writers, influencers/creators, bylined articles, show pages, "
                "author pages, and contact pages."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "limit": {"type": "integer", "default": 10},
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "upsert_contact",
            "description": (
                "Add or update a verified media contact (journalist, podcaster, blogger, "
                "or influencer). Never invent emails or names."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "Journalist": {"type": "string"},
                    "Email": {"type": "string"},
                    "Email_Type": {
                        "type": "string",
                        "description": "e.g. Personal (author page), Outlet editorial desk, Not found publicly",
                    },
                    "Publication": {"type": "string"},
                    "Outlet_Type": {"type": "string"},
                    "Role": {"type": "string"},
                    "Theme_Fit": {"type": "string"},
                    "Example_Coverage_URL": {"type": "string"},
                    "Notes": {"type": "string"},
                },
                "required": ["Journalist", "Publication", "Outlet_Type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_contacts",
            "description": "List contacts collected so far.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "lookup_journalist",
            "description": (
                f"Look up a journalist in the shared media_list_journalists cache. "
                f"If found and updated_at is within {FRESH_DAYS} days, reuse Email/Hunter fields "
                f"instead of Firecrawl/Hunter. If stale or missing, continue research and the row will be refreshed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "Journalist": {"type": "string"},
                    "Publication": {
                        "type": "string",
                        "description": "Optional; used when applying a fresh hit onto the current list",
                    },
                },
                "required": ["Journalist"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "hunter_find_email",
            "description": (
                "Look up a likely email via Hunter.io for a contact already on the list "
                "(or about to be upserted). Stores results in Hunter_* CSV fields. "
                "Provide domain when known (from the outlet website); otherwise publication + coverage URL are used."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "Journalist": {"type": "string"},
                    "Publication": {"type": "string"},
                    "domain": {
                        "type": "string",
                        "description": "Outlet domain, e.g. nutraingredients.com or wrbm.com",
                    },
                    "force": {
                        "type": "boolean",
                        "description": "Re-query even if Hunter_Email already set",
                        "default": False,
                    },
                },
                "required": ["Journalist", "Publication"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_brand_context",
            "description": "Store brand summary, themes, and press release URLs extracted from the newsroom.",
            "parameters": {
                "type": "object",
                "properties": {
                    "brand_summary": {"type": "string"},
                    "themes": {"type": "array", "items": {"type": "string"}},
                    "pr_urls": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["brand_summary", "themes"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "finish",
            "description": "Write the CSV and end the research loop.",
            "parameters": {
                "type": "object",
                "properties": {
                    "summary": {"type": "string"},
                },
                "required": ["summary"],
            },
        },
    },
]


def write_csv(state: AgentState) -> Path:
    state.output_path.parent.mkdir(parents=True, exist_ok=True)
    rows = sorted(state.contacts.values(), key=lambda c: (c.Publication.lower(), c.Journalist.lower()))
    with state.output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row in rows:
            writer.writerow(row.model_dump())
    return state.output_path


def dispatch_tool(state: AgentState, name: str, args: dict[str, Any]) -> dict[str, Any]:
    if name == "scrape_url":
        return tool_scrape_url(args["url"], bool(args.get("only_main", True)))
    if name == "web_search":
        return tool_web_search(args["query"], int(args.get("limit", 10)))
    if name == "upsert_contact":
        c = Contact(**{k: (args.get(k) or "") for k in CSV_FIELDS})
        if not c.Email:
            c.Email_Type = c.Email_Type or "Not found publicly"
        key = contact_key(c.Journalist, c.Publication)
        existing = state.contacts.get(key)
        if existing:
            merged = existing.model_dump()
            changed = False
            for k, v in c.model_dump().items():
                if v and v != merged.get(k):
                    merged[k] = v
                    changed = True
            state.contacts[key] = Contact(**merged)
            if changed:
                state.updated_count += 1
            action = "updated" if changed else "unchanged"
        else:
            state.contacts[key] = c
            state.added_count += 1
            action = "added"
        return {
            "ok": True,
            "action": action,
            "stored": state.contacts[key].model_dump(),
            "total_contacts": len(state.contacts),
            "added_this_run": state.added_count,
            "updated_this_run": state.updated_count,
        }
    if name == "hunter_find_email":
        if not hunter_api_key():
            return {"ok": False, "error": "HUNTER_IO_API not configured"}
        journalist = (args.get("Journalist") or "").strip()
        publication = (args.get("Publication") or "").strip()
        if not journalist or not publication:
            return {"ok": False, "error": "Journalist and Publication are required"}
        key = contact_key(journalist, publication)
        contact = state.contacts.get(key)
        if not contact:
            # Create a stub so Hunter results can be stored; agent should upsert full row too
            contact = Contact(Journalist=journalist, Publication=publication)
            state.contacts[key] = contact
            state.added_count += 1

        force = bool(args.get("force", False))
        # Fresh DB hit avoids Hunter spend
        if not force and journalist_table_exists():
            try:
                hit = lookup_journalist(journalist)
            except Exception as e:
                hit = None
                print(f"  db lookup error: {e}")
            if hit and hit.get("fresh") and (
                hit["fields"].get("Hunter_Email") or hit["fields"].get("Hunter_Status")
            ):
                apply_cached_fields(contact, hit["fields"])
                apply_hunter_fields(contact, hit["fields"], force=True)
                state.updated_count += 1
                return {
                    "ok": True,
                    "source": "db_cache",
                    "fresh": True,
                    "hunter": {k: hit["fields"].get(k) for k in HUNTER_FIELDS},
                    "stored": contact.model_dump(),
                }

        result = enrich_row(
            journalist=contact.Journalist,
            publication=contact.Publication,
            example_url=contact.Example_Coverage_URL,
            domain=(args.get("domain") or "").strip(),
            force=force,
            existing_hunter_email=contact.Hunter_Email,
        )
        if result.get("skipped") and result.get("Hunter_Status") == "already_set":
            return {
                "ok": True,
                "skipped": True,
                "stored": contact.model_dump(),
                "message": "Hunter_Email already set; pass force=true to refresh",
            }
        changed = apply_hunter_fields(contact, result, force=True)
        if changed:
            state.updated_count += 1
        # Persist enrichment for future lists
        try:
            if journalist_table_exists():
                upsert_from_contact(contact, source_list=state.slug)
        except Exception as e:
            print(f"  db upsert error: {e}")
        return {
            "ok": True,
            "source": "hunter",
            "hunter": {k: result.get(k) for k in HUNTER_FIELDS},
            "cached": result.get("cached", False),
            "stored": contact.model_dump(),
        }
    if name == "lookup_journalist":
        journalist = (args.get("Journalist") or "").strip()
        if not journalist:
            return {"ok": False, "error": "Journalist is required"}
        if not journalist_table_exists():
            return {
                "ok": False,
                "error": "media_list_journalists table not found — run workers/sql/2026-08-14-media-list-journalists.sql",
            }
        try:
            hit = lookup_journalist(journalist)
        except Exception as e:
            return {"ok": False, "error": str(e)}
        if not hit:
            return {"ok": True, "found": False, "fresh": False, "message": "No cache row"}
        publication = (args.get("Publication") or hit["fields"].get("Publication") or "").strip()
        applied = False
        if hit["fresh"] and publication:
            key = contact_key(journalist, publication)
            contact = state.contacts.get(key) or Contact(
                Journalist=journalist,
                Publication=publication,
                Outlet_Type=hit["fields"].get("Outlet_Type") or "",
            )
            before = contact.model_dump()
            apply_cached_fields(contact, hit["fields"])
            if key not in state.contacts:
                state.contacts[key] = contact
                state.added_count += 1
                applied = True
            elif contact.model_dump() != before:
                state.contacts[key] = contact
                state.updated_count += 1
                applied = True
        return {
            "ok": True,
            "found": True,
            "fresh": hit["fresh"],
            "fresh_days": FRESH_DAYS,
            "applied_to_list": applied,
            "fields": hit["fields"],
            "updated_at": hit["row"].get("updated_at").isoformat()
            if hit["row"].get("updated_at")
            else None,
            "message": (
                "Fresh cache hit — reuse fields; skip Firecrawl/Hunter for this person"
                if hit["fresh"]
                else f"Stale (>{FRESH_DAYS}d) — refresh via crawl/Hunter then upsert"
            ),
        }
    if name == "list_contacts":
        missing_email = [
            {"Journalist": c.Journalist, "Publication": c.Publication}
            for c in state.contacts.values()
            if not c.Email
        ]
        missing_hunter = [
            {"Journalist": c.Journalist, "Publication": c.Publication}
            for c in state.contacts.values()
            if not c.Hunter_Email
        ]
        return {
            "ok": True,
            "total": len(state.contacts),
            "loaded_from_disk": state.loaded_existing,
            "baseline_count": state.baseline_count,
            "missing_email_count": len(missing_email),
            "missing_email": missing_email[:50],
            "missing_hunter_count": len(missing_hunter),
            "missing_hunter": missing_hunter[:50],
            "contacts": [c.model_dump() for c in state.contacts.values()],
        }
    if name == "set_brand_context":
        state.brand_summary = args.get("brand_summary") or ""
        state.themes = list(args.get("themes") or [])
        if args.get("pr_urls"):
            state.pr_urls = list(args["pr_urls"])
        return {
            "ok": True,
            "brand_summary": state.brand_summary,
            "themes": state.themes,
            "pr_urls": state.pr_urls,
        }
    if name == "finish":
        print("Enriching contacts with Hunter.io before write...")
        hunter_stats = enrich_contacts_with_hunter(state.contacts)
        print("Syncing journalists to media_list_journalists...")
        db_stats = sync_contacts_to_db(state.contacts, source_list=state.slug)
        path = write_csv(state)
        return {
            "ok": True,
            "done": True,
            "output_path": str(path),
            "contact_count": len(state.contacts),
            "baseline_count": state.baseline_count,
            "added_this_run": state.added_count,
            "updated_this_run": state.updated_count,
            "with_email": sum(1 for c in state.contacts.values() if c.Email),
            "with_hunter_email": sum(1 for c in state.contacts.values() if c.Hunter_Email),
            "hunter_stats": hunter_stats,
            "db_stats": db_stats,
            "summary": args.get("summary", ""),
        }
    return {"ok": False, "error": f"Unknown tool: {name}"}


def make_client() -> OpenAI:
    api_key = os.getenv("XAI_API_KEY")
    if not api_key:
        raise SystemExit(
            "XAI_API_KEY is required. Set it in workers/.env or the environment.\n"
            "Get a key at https://console.x.ai/"
        )
    return OpenAI(api_key=api_key, base_url=os.getenv("XAI_BASE_URL", "https://api.x.ai/v1"))


def run_agent(newsroom_url: str, output_path: Path | None = None, max_turns: int = 40) -> AgentState:
    slug = slug_from_newsroom_url(newsroom_url)
    out = Path(output_path).resolve() if output_path else default_list_path(slug)
    LISTS_DIR.mkdir(parents=True, exist_ok=True)

    existing = load_existing_contacts(out)
    state = AgentState(
        newsroom_url=newsroom_url,
        slug=slug,
        output_path=out,
        contacts=existing,
        loaded_existing=bool(existing),
        baseline_count=len(existing),
    )
    client = make_client()
    model = os.getenv("XAI_MODEL", "grok-4.5")

    if existing:
        missing = sum(1 for c in existing.values() if not c.Email)
        user_content = (
            f"INCREMENTAL UPDATE for newsroom:\n{newsroom_url}\n\n"
            f"Existing list loaded from: {out}\n"
            f"Baseline contacts: {len(existing)} ({missing} missing email).\n"
            f"Do NOT rebuild from scratch. Call list_contacts, then find NEW contacts across "
            f"journalists, podcasters, bloggers, and influencers, and fill missing emails. "
            f"Preserve everyone already on the list.\n"
            f"CSV columns must be exactly: {', '.join(CSV_FIELDS)}\n"
            "Start by calling list_contacts, then scrape the newsroom for any new themes/releases."
        )
    else:
        user_content = (
            f"Build a NEW verified media CSV for this newsroom:\n{newsroom_url}\n\n"
            f"Include journalists/editors, podcasters, bloggers/newsletters, and influencers/creators.\n"
            f"Write final output to: {out}\n"
            f"CSV columns must be exactly: {', '.join(CSV_FIELDS)}\n"
            "Start by scraping the newsroom page."
        )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    print(f"Model: {model}")
    print(f"Newsroom: {newsroom_url}")
    print(f"Output: {out}")
    if existing:
        print(f"Loaded existing list: {len(existing)} contacts (incremental mode)")
    else:
        print("No existing list — creating new")

    for turn in range(1, max_turns + 1):
        print(f"\n--- turn {turn}/{max_turns} ---")
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.2,
        )
        msg = resp.choices[0].message
        # Append assistant message (including tool calls)
        assistant_msg: dict[str, Any] = {"role": "assistant", "content": msg.content or ""}
        if msg.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments or "{}",
                    },
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_msg)

        if not msg.tool_calls:
            # Model stopped without finish — force CSV write if we have contacts
            if state.contacts:
                print("Enriching contacts with Hunter.io before write...")
                enrich_contacts_with_hunter(state.contacts)
                print("Syncing journalists to media_list_journalists...")
                sync_contacts_to_db(state.contacts, source_list=state.slug)
                write_csv(state)
                print("Model stopped without finish(); wrote CSV from collected contacts.")
            else:
                print("Model stopped with no contacts collected.")
            break

        finished = False
        for tc in msg.tool_calls:
            name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            print(f"tool: {name}({json.dumps(args)[:200]})")
            result = dispatch_tool(state, name, args)
            # Keep tool responses compact for scrape markdown
            if name == "scrape_url" and result.get("ok") and result.get("markdown"):
                preview = result["markdown"]
                result = {
                    **result,
                    "markdown": preview[:12000],
                }
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": json.dumps(result)[:50000],
                }
            )
            if result.get("done"):
                finished = True
                print(
                    f"Done. {result.get('contact_count')} contacts "
                    f"(+{result.get('added_this_run', 0)} added, "
                    f"{result.get('updated_this_run', 0)} updated; "
                    f"{result.get('with_email')} with email, "
                    f"{result.get('with_hunter_email')} with Hunter email) → {result.get('output_path')}"
                )
                if result.get("hunter_stats"):
                    print(f"Hunter: {result['hunter_stats']}")
                if result.get("summary"):
                    print(result["summary"])
        if finished:
            break
    else:
        # max turns hit
        print("Enriching contacts with Hunter.io before write...")
        enrich_contacts_with_hunter(state.contacts)
        print("Syncing journalists to media_list_journalists...")
        sync_contacts_to_db(state.contacts, source_list=state.slug)
        write_csv(state)
        print(
            f"Hit max turns; wrote {len(state.contacts)} contacts "
            f"(+{state.added_count} added, {state.updated_count} updated) to {state.output_path}"
        )

    return state


def enrich_list_files(paths: list[Path], *, force: bool = False) -> int:
    """Backfill Hunter fields for one or more CSV list files."""
    if not hunter_api_key():
        raise SystemExit("HUNTER_IO_API is required in workers/.env")

    total_found = 0
    for path in paths:
        path = path.resolve()
        if not path.exists():
            print(f"Skip missing: {path}")
            continue
        print(f"\n=== Enriching {path} ===")
        contacts = load_existing_contacts(path)
        if not contacts:
            print("No contacts found")
            continue
        stats = enrich_contacts_with_hunter(contacts, force=force)
        # Write with full field set (upgrades older CSVs)
        tmp_state = AgentState(
            newsroom_url="",
            slug=path.stem,
            output_path=path,
            contacts=contacts,
            loaded_existing=True,
            baseline_count=len(contacts),
        )
        write_csv(tmp_state)
        found = sum(1 for c in contacts.values() if c.Hunter_Email)
        total_found += found
        print(f"Wrote {path} — {found}/{len(contacts)} have Hunter_Email | stats={stats}")
    return total_found


def backfill_journalists_db(paths: list[Path]) -> dict[str, int]:
    """Load CSV lists into media_list_journalists (one row per journalist name)."""
    if not journalist_table_exists():
        raise SystemExit(
            "Table media_list_journalists not found.\n"
            "Create it first:\n"
            '  psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-08-14-media-list-journalists.sql'
        )

    totals = {"files": 0, "rows_read": 0, "synced": 0, "errors": 0}
    # Dedupe across files by name_key so we upsert richest data last
    by_name: dict[str, Contact] = {}
    source_for: dict[str, str] = {}

    for path in paths:
        path = path.resolve()
        if not path.exists():
            print(f"Skip missing: {path}")
            continue
        totals["files"] += 1
        contacts = load_existing_contacts(path)
        print(f"Loaded {len(contacts)} from {path.name}")
        totals["rows_read"] += len(contacts)
        for contact in contacts.values():
            key = normalize_name_key(contact.Journalist)
            if not key:
                continue
            existing = by_name.get(key)
            if not existing:
                by_name[key] = contact
                source_for[key] = path.stem
                continue
            # Merge: prefer non-empty fields; keep both publications if different
            merged = existing.model_dump()
            new = contact.model_dump()
            for k, v in new.items():
                if not v:
                    continue
                if not merged.get(k):
                    merged[k] = v
                elif k == "Publication" and v.lower() not in (merged.get("Publication") or "").lower():
                    merged[k] = f"{merged['Publication']} / {v}"
                elif k == "Notes" and v not in (merged.get("Notes") or ""):
                    merged[k] = f"{merged.get('Notes') or ''}; {v}".strip("; ")
            # Prefer higher hunter score when both present
            try:
                if int(new.get("Hunter_Score") or 0) > int(merged.get("Hunter_Score") or 0):
                    for hk in HUNTER_FIELDS:
                        if new.get(hk):
                            merged[hk] = new[hk]
            except ValueError:
                pass
            by_name[key] = Contact(**merged)
            # keep first source; also record via upsert source_list later as path.stem of last win
            source_for[key] = source_for.get(key) or path.stem

    print(f"\nUpserting {len(by_name)} unique journalists...")
    for key, contact in by_name.items():
        try:
            # Attach all contributing list slugs by upserting once per known slug is heavy;
            # use primary source then a second pass for list membership.
            upsert_from_contact(contact, source_list=source_for.get(key))
            totals["synced"] += 1
        except Exception as e:
            totals["errors"] += 1
            print(f"  error {contact.Journalist}: {e}")

    # Second pass: ensure source_lists includes every CSV the person appeared in
    for path in paths:
        path = path.resolve()
        if not path.exists():
            continue
        for contact in load_existing_contacts(path).values():
            try:
                upsert_from_contact(contact, source_list=path.stem)
            except Exception:
                pass

    return totals


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Research journalists for a Newsworthy newsroom using Grok 4.5 + Firecrawl + Hunter.io"
    )
    parser.add_argument(
        "newsroom_url",
        nargs="?",
        help="e.g. https://www.newsworthy.ai/newsroom/santos-muscle-nutrition",
    )
    parser.add_argument(
        "-o",
        "--output",
        help="Output CSV path (default: workers/lists/{slug}.csv)",
    )
    parser.add_argument("--max-turns", type=int, default=40)
    parser.add_argument(
        "--enrich-hunter",
        nargs="*",
        metavar="CSV",
        help=(
            "Backfill Hunter.io fields on existing list CSVs and exit. "
            "Pass file paths, or omit paths to enrich all workers/lists/*.csv"
        ),
    )
    parser.add_argument(
        "--force-hunter",
        action="store_true",
        help="Re-query Hunter even when Hunter_Email/status already set",
    )
    parser.add_argument(
        "--backfill-db",
        nargs="*",
        metavar="CSV",
        help=(
            "Upsert journalists from list CSVs into media_list_journalists and exit. "
            "Omit paths to use all workers/lists/*.csv"
        ),
    )
    args = parser.parse_args(argv)

    if args.backfill_db is not None:
        paths = [Path(p) for p in args.backfill_db] if args.backfill_db else sorted(LISTS_DIR.glob("*.csv"))
        if not paths:
            raise SystemExit(f"No CSV lists found under {LISTS_DIR}")
        stats = backfill_journalists_db(paths)
        print(f"\nDB backfill complete: {stats}")
        return 0 if stats.get("errors", 0) == 0 else 1

    if args.enrich_hunter is not None:
        if args.enrich_hunter:
            paths = [Path(p) for p in args.enrich_hunter]
        else:
            paths = sorted(LISTS_DIR.glob("*.csv"))
        if not paths:
            raise SystemExit(f"No CSV lists found under {LISTS_DIR}")
        enrich_list_files(paths, force=args.force_hunter)
        return 0

    if not args.newsroom_url:
        parser.error("newsroom_url is required unless --enrich-hunter / --backfill-db is used")

    out = Path(args.output).resolve() if args.output else None
    state = run_agent(args.newsroom_url, output_path=out, max_turns=args.max_turns)
    print(f"\nContacts: {len(state.contacts)} (started with {state.baseline_count})")
    print(f"Added: {state.added_count} | Updated: {state.updated_count}")
    print(f"With crawled Email: {sum(1 for c in state.contacts.values() if c.Email)}")
    print(f"With Hunter_Email: {sum(1 for c in state.contacts.values() if c.Hunter_Email)}")
    print(f"CSV: {state.output_path}")
    return 0 if state.contacts else 1


if __name__ == "__main__":
    raise SystemExit(main())
