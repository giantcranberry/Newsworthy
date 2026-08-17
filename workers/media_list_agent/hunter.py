"""Hunter.io email finder helpers for media-list enrichment."""

from __future__ import annotations

import hashlib
import json
import os
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

WORKERS_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = WORKERS_ROOT / ".cache" / "hunter"

HUNTER_FIELDS = [
    "Hunter_Email",
    "Hunter_Score",
    "Hunter_Verification",
    "Hunter_Domain",
    "Hunter_Company",
    "Hunter_Status",
    "Hunter_Source_URL",
]

SKIP_DOMAINS = {
    "linkedin.com",
    "www.linkedin.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "youtu.be",
    "open.spotify.com",
    "podcasts.apple.com",
    "muckrack.com",
    "wikipedia.org",
    "en.wikipedia.org",
    "newsworthy.ai",
    "www.newsworthy.ai",
    "google.com",
    "docs.google.com",
}


def hunter_api_key() -> str | None:
    return os.getenv("HUNTER_IO_API") or os.getenv("HUNTER_API_KEY") or None


def split_person_name(full_name: str) -> tuple[str, str]:
    """Best-effort first/last split for Hunter."""
    cleaned = re.sub(r"\s+", " ", (full_name or "").strip())
    cleaned = re.sub(r"^(dr|mr|mrs|ms|prof)\.?\s+", "", cleaned, flags=re.I)
    parts = [p for p in cleaned.replace(",", " ").split() if p]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    # Drop obvious suffixes
    while parts and parts[-1].lower().rstrip(".") in {"jr", "sr", "ii", "iii", "iv", "phd", "md", "rd"}:
        parts.pop()
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[-1]


def domain_from_url(url: str) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower().strip()
    except Exception:
        return None
    if not host:
        return None
    host = host.removeprefix("www.")
    # Skip social / aggregator hosts
    if host in SKIP_DOMAINS or any(host.endswith("." + d.removeprefix("www.")) for d in SKIP_DOMAINS):
        return None
    return host


def publication_company(publication: str) -> str:
    """Use the primary publication name as Hunter company."""
    if not publication:
        return ""
    primary = re.split(r"[;/|]", publication, maxsplit=1)[0].strip()
    # Drop trailing parentheticals
    primary = re.sub(r"\s*\([^)]*\)\s*$", "", primary).strip()
    return primary


def _cache_path(payload: dict[str, str]) -> Path:
    key = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:40]
    return CACHE_DIR / f"{key}.json"


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
def _hunter_get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    api_key = hunter_api_key()
    if not api_key:
        raise RuntimeError("HUNTER_IO_API is not set")
    q = {k: v for k, v in params.items() if v not in (None, "")}
    q["api_key"] = api_key
    with httpx.Client(timeout=45.0) as client:
        resp = client.get(f"https://api.hunter.io/v2/{path}", params=q)
    if resp.status_code == 429:
        time.sleep(2)
        raise RuntimeError("Hunter rate limited")
    if resp.status_code >= 400:
        try:
            detail = resp.json()
        except Exception:
            detail = {"raw": resp.text[:500]}
        return {"ok": False, "status_code": resp.status_code, "error": detail}
    return {"ok": True, "status_code": resp.status_code, "body": resp.json()}


def domain_finder(company: str, limit: int = 3) -> list[dict[str, str]]:
    if not company or len(company) < 3:
        return []
    result = _hunter_get("domain-finder", {"company": company, "limit": limit})
    if not result.get("ok"):
        return []
    data = result["body"].get("data") or []
    out = []
    for item in data:
        domain = (item.get("domain") or "").strip()
        if domain:
            out.append({"domain": domain, "company_name": item.get("company_name") or company})
    return out


def email_finder(
    *,
    full_name: str,
    domain: str | None = None,
    company: str | None = None,
    use_cache: bool = True,
) -> dict[str, Any]:
    """Call Hunter Email Finder. Returns normalized result dict."""
    first, last = split_person_name(full_name)
    params: dict[str, Any] = {}
    if first and last:
        params["first_name"] = first
        params["last_name"] = last
    else:
        params["full_name"] = full_name.strip()
    if domain:
        params["domain"] = domain
    elif company:
        params["company"] = company
    else:
        return {
            "ok": False,
            "status": "skipped",
            "error": "Need domain or company",
            "Hunter_Status": "skipped_no_domain",
        }

    cache_key = {k: str(v) for k, v in params.items()}
    if use_cache:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = _cache_path(cache_key)
        if path.exists():
            cached = json.loads(path.read_text())
            cached["cached"] = True
            return cached

    raw = _hunter_get("email-finder", params)
    if not raw.get("ok"):
        err = raw.get("error") or {}
        # Hunter returns errors like {"errors":[{"id":"...", "details":"..."}]}
        err_id = ""
        if isinstance(err, dict):
            errors = err.get("errors") or []
            if errors:
                err_id = errors[0].get("id") or errors[0].get("details") or ""
        status = "not_found" if raw.get("status_code") in (404, 400) else "error"
        if err_id in {"email_not_found", "invalid_domain", "claimed_email"}:
            status = "not_found" if err_id != "claimed_email" else "claimed"
        out = {
            "ok": False,
            "status": status,
            "error": err,
            "Hunter_Email": "",
            "Hunter_Score": "",
            "Hunter_Verification": "",
            "Hunter_Domain": domain or "",
            "Hunter_Company": company or "",
            "Hunter_Status": status,
            "Hunter_Source_URL": "",
            "params": params,
        }
        if use_cache and status in {"not_found", "claimed"}:
            path.write_text(json.dumps(out, indent=2))
        return out

    data = (raw["body"] or {}).get("data") or {}
    sources = data.get("sources") or []
    source_url = ""
    if sources:
        source_url = sources[0].get("uri") or sources[0].get("domain") or ""
    verification = data.get("verification") or {}
    email = (data.get("email") or "").strip()
    out = {
        "ok": bool(email),
        "status": "found" if email else "not_found",
        "Hunter_Email": email,
        "Hunter_Score": str(data.get("score") if data.get("score") is not None else ""),
        "Hunter_Verification": str(verification.get("status") or ""),
        "Hunter_Domain": str(data.get("domain") or domain or ""),
        "Hunter_Company": str(data.get("company") or company or ""),
        "Hunter_Status": "found" if email else "not_found",
        "Hunter_Source_URL": source_url,
        "position": data.get("position"),
        "params": params,
        "cached": False,
    }
    if use_cache:
        path.write_text(json.dumps(out, indent=2))
    # Be polite even though limit is high
    time.sleep(0.15)
    return out


def resolve_domain_and_company(
    *,
    publication: str,
    example_url: str = "",
    explicit_domain: str = "",
) -> tuple[str | None, str | None]:
    if explicit_domain:
        return explicit_domain.strip().lower().removeprefix("www."), None
    domain = domain_from_url(example_url)
    company = publication_company(publication)
    if domain:
        return domain, company or None
    if company:
        # Free domain lookup before spending finder credits
        suggestions = domain_finder(company, limit=3)
        if suggestions:
            return suggestions[0]["domain"], company
        return None, company
    return None, None


def hunter_fields_from_result(result: dict[str, Any]) -> dict[str, str]:
    return {k: str(result.get(k) or "") for k in HUNTER_FIELDS}


def enrich_row(
    *,
    journalist: str,
    publication: str,
    example_url: str = "",
    domain: str = "",
    force: bool = False,
    existing_hunter_email: str = "",
) -> dict[str, Any]:
    """Enrich one person; returns Hunter_* fields + meta."""
    if existing_hunter_email and not force:
        return {
            "ok": True,
            "skipped": True,
            "Hunter_Status": "already_set",
            **{k: "" for k in HUNTER_FIELDS},
        }

    domain_r, company_r = resolve_domain_and_company(
        publication=publication,
        example_url=example_url,
        explicit_domain=domain,
    )
    if not domain_r and not company_r:
        return {
            "ok": False,
            "skipped": True,
            **hunter_fields_from_result(
                {
                    "Hunter_Status": "skipped_no_domain",
                }
            ),
        }

    result = email_finder(full_name=journalist, domain=domain_r, company=company_r)
    fields = hunter_fields_from_result(result)
    return {
        "ok": result.get("ok", False),
        "skipped": False,
        "cached": result.get("cached", False),
        "error": result.get("error"),
        **fields,
    }
