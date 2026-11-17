"""Firecrawl fallback for pages a plain download cannot read.

The key is FIRECRAWL_API_KEY in the environment or the project .env file.
Scrapes are used only when a publisher page is blocked or empty. Search is
used to find a real contact page on that site. Nothing here invents an address.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv

API = "https://api.firecrawl.dev/v2"


def api_key() -> str | None:
    load_dotenv()
    project_env = Path(__file__).resolve().parents[1] / ".env"
    if project_env.exists():
        load_dotenv(project_env)
    key = (os.getenv("FIRECRAWL_API_KEY") or "").strip()
    return key or None


def scrape(url: str, *, timeout: float = 60) -> dict | None:
    """Return the Firecrawl data object, or None when the request fails."""
    key = api_key()
    if not key:
        return None
    try:
        response = httpx.post(
            f"{API}/scrape",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "url": url,
                "formats": ["rawHtml", "markdown", "links"],
                "onlyMainContent": False,
                "blockAds": True,
                "timeout": int(timeout * 1000),
            },
            timeout=timeout + 15,
        )
    except httpx.HTTPError:
        return None
    if response.status_code == 401:
        raise RuntimeError("Firecrawl rejected FIRECRAWL_API_KEY")
    if response.status_code >= 400:
        return None
    body = response.json()
    if not body.get("success"):
        return None
    data = body.get("data")
    return data if isinstance(data, dict) else None


def search(query: str, host: str, *, limit: int = 4, timeout: float = 30) -> list[str]:
    """URLs on one publisher host. Empty when search is unavailable."""
    key = api_key()
    if not key or not host:
        return []
    domain = host.lower().removeprefix("www.")
    try:
        response = httpx.post(
            f"{API}/search",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "query": query,
                "limit": limit,
                "sources": ["web"],
                "includeDomains": [domain],
            },
            timeout=timeout,
        )
    except httpx.HTTPError:
        return []
    if response.status_code == 401:
        raise RuntimeError("Firecrawl rejected FIRECRAWL_API_KEY")
    if response.status_code >= 400:
        return []
    body = response.json()
    web = (body.get("data") or {}).get("web") or []
    found: list[str] = []
    seen: set[str] = set()
    for item in web:
        target = (item.get("url") or "").strip()
        if not target.startswith("http") or target in seen:
            continue
        link_host = urlsplit(target).netloc.lower().removeprefix("www.")
        if link_host != domain and not link_host.endswith("." + domain):
            continue
        seen.add(target)
        found.append(target)
        if len(found) >= limit:
            break
    return found
