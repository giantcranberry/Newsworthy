"""Fetch a public page and return the addresses it actually prints."""

from __future__ import annotations

import json
import subprocess
from dataclasses import asdict, dataclass, field
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

import httpx
from bs4 import BeautifulSoup

from media_lists.emails import CF_RE, MAILTO_RE, addresses_in, clean_address, decode_cf
from media_lists.firecrawl import api_key as firecrawl_key
from media_lists.firecrawl import scrape as firecrawl_scrape
from media_lists.firecrawl import search as firecrawl_search

UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)


@dataclass
class FoundEmail:
    address: str
    context: str
    method: str


@dataclass
class PageEvidence:
    url: str
    final_url: str = ""
    status: int | None = None
    title: str = ""
    emails: list[FoundEmail] = field(default_factory=list)
    error: str | None = None
    fetch_method: str = ""
    text_len: int = 0
    text: str = ""
    html: str = ""

    def to_json(self) -> dict:
        data = asdict(self)
        # The brief is saved on its own. Don't write full pages into the cache.
        data.pop("text", None)
        data.pop("html", None)
        return data

    @classmethod
    def from_json(cls, data: dict) -> PageEvidence:
        emails = [FoundEmail(**item) for item in data.get("emails") or []]
        payload = dict(data)
        payload["emails"] = emails
        return cls(**payload)


def _context(text: str, address: str) -> str:
    hay = text or ""
    index = hay.lower().find(address.lower())
    if index < 0:
        return ""
    snippet = hay[max(0, index - 160) : index + len(address) + 160]
    return " ".join(snippet.split())


def _add(
    found: list[FoundEmail],
    seen: set[str],
    address: str,
    text: str,
    method: str,
    context: str | None = None,
) -> None:
    cleaned = clean_address(address)
    if not cleaned:
        return
    key = cleaned.casefold()
    if key in seen:
        return
    seen.add(key)
    snippet = " ".join((context or "").split())[:400] or _context(text, cleaned)
    found.append(FoundEmail(cleaned, snippet, method))


def extract_from_html(html: str, url: str) -> tuple[str, str, list[FoundEmail]]:
    soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    title = " ".join((soup.title.get_text(" ", strip=True) if soup.title else "").split())
    found: list[FoundEmail] = []
    seen: set[str] = set()
    raw = html or ""
    for anchor in soup.select("a[href^='mailto:'], a[href*='mailto:']"):
        href = anchor.get("href") or ""
        parent = anchor.parent.get_text(" ", strip=True) if anchor.parent else ""
        _add(found, seen, unquote(href), parent, "mailto", context=parent)
    for node in soup.select("[data-cfemail], a[href*='email-protection']"):
        encoded = node.get("data-cfemail") or ""
        if not encoded and node.has_attr("href") and "email-protection#" in node["href"]:
            encoded = node["href"].split("email-protection#", 1)[1]
        encoded = "".join(char for char in encoded if char in "0123456789abcdefABCDEF")
        if not encoded:
            continue
        try:
            decoded = decode_cf(encoded)
        except ValueError:
            continue
        parent = node.parent.get_text(" ", strip=True) if node.parent else ""
        label = parent.replace("[email protected]", decoded)
        _add(found, seen, decoded, label, "cloudflare", context=label)
    text = " ".join(soup.get_text(" ", strip=True).split())
    for match in MAILTO_RE.finditer(raw):
        _add(found, seen, unquote(match.group(1)), text, "mailto")
    for match in CF_RE.finditer(raw):
        try:
            decoded = decode_cf(match.group(1))
        except ValueError:
            continue
        _add(found, seen, decoded, text, "cloudflare")
    for address in addresses_in(raw):
        _add(found, seen, address, text, "plaintext")
    for address in addresses_in(text):
        _add(found, seen, address, text, "plaintext")
    if not found and url.lower().split("?", 1)[0].endswith(".pdf"):
        for address in addresses_in(text):
            _add(found, seen, address, text, "pdf")
    return title, text, found


def _pdf_text(data: bytes) -> str:
    try:
        completed = subprocess.run(
            ["pdftotext", "-layout", "-", "-"],
            input=data,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"pdftotext failed: {exc}") from exc
    if completed.returncode != 0:
        err = completed.stderr.decode("utf-8", "replace")[:200]
        raise RuntimeError(err or "pdftotext failed")
    return completed.stdout.decode("utf-8", "replace")


def _chromium_dump(url: str, binary: str) -> str:
    cmd = [
        binary,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--virtual-time-budget=8000",
        "--dump-dom",
        url,
    ]
    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            timeout=45,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"chromium failed: {exc}") from exc
    html = completed.stdout.decode("utf-8", "replace")
    if not html.strip():
        err = completed.stderr.decode("utf-8", "replace")[-240:]
        raise RuntimeError(err or "chromium returned an empty page")
    return html


def _evidence_from_html(url: str, final_url: str, status: int | None, html: str, method: str) -> PageEvidence:
    title, text, emails = extract_from_html(html, final_url or url)
    return PageEvidence(
        url=url,
        final_url=final_url or url,
        status=status,
        title=title[:180],
        emails=emails,
        error=None,
        fetch_method=method,
        text_len=len(text),
        text=text[:20000],
        html=html[:500000],
    )


def _from_firecrawl(url: str, timeout: float) -> PageEvidence | None:
    data = firecrawl_scrape(url, timeout=max(timeout, 45))
    if not data:
        return None
    metadata = data.get("metadata") or {}
    status = metadata.get("statusCode") or metadata.get("pageStatusCode")
    try:
        status_code = int(status) if status is not None else None
    except (TypeError, ValueError):
        status_code = None
    raw = data.get("rawHtml") or data.get("html") or ""
    markdown = data.get("markdown") or ""
    if raw:
        page = _evidence_from_html(url, metadata.get("sourceURL") or url, status_code, raw, "firecrawl")
    else:
        text = " ".join(markdown.split())
        emails = []
        seen: set[str] = set()
        for address in addresses_in(markdown):
            _add(emails, seen, address, text, "plaintext")
        page = PageEvidence(
            url=url,
            final_url=metadata.get("sourceURL") or url,
            status=status_code,
            title=(metadata.get("title") or "")[:180],
            emails=emails,
            fetch_method="firecrawl",
            text_len=len(text),
            text=text[:20000],
        )
    if not page.title and metadata.get("title"):
        page.title = str(metadata["title"])[:180]
    for address in addresses_in(markdown):
        _add(page.emails, {item.address.casefold() for item in page.emails}, address, page.text, "plaintext")
    return page


def fetch_page(
    url: str,
    *,
    client: httpx.Client | None = None,
    chromium: str | None = "/usr/bin/chromium",
    use_chromium: bool = True,
    use_firecrawl: bool | None = None,
    force_browser: bool = False,
    timeout: float = 20,
) -> PageEvidence:
    """Fetch one URL. Firecrawl, then Chromium, when plain HTTP is blocked."""
    own_client = client is None
    http = client or httpx.Client(follow_redirects=True, timeout=timeout, headers={"User-Agent": UA})
    try:
        try:
            response = http.get(url)
        except httpx.HTTPError as exc:
            response = None
            http_error = str(exc)
        else:
            http_error = None
        if response is not None and _looks_like_pdf(url, response):
            try:
                text = _pdf_text(response.content)
            except RuntimeError as exc:
                return PageEvidence(url=url, final_url=str(response.url), status=response.status_code, error=str(exc), fetch_method="pdf")
            html = f"<html><head><title>{url}</title></head><body><pre>{text}</pre></body></html>"
            page = _evidence_from_html(url, str(response.url), response.status_code, html, "pdf")
            for item in page.emails:
                item.method = "pdf"
            return page
        html = response.text if response is not None else ""
        status = response.status_code if response is not None else None
        final = str(response.url) if response is not None else url
        blocked = status in {401, 402, 403, 429, 503} or http_error is not None
        challenge = "cf-browser-verification" in html or "Just a moment" in html[:2000]
        page = _evidence_from_html(url, final, status, html, "http") if html else PageEvidence(url=url, error=http_error, fetch_method="http")
        if status in {404, 410} and not page.emails:
            page.error = f"HTTP {status}"
            return page
        usable = bool(page.emails) or page.text_len > 2500
        http_ok = usable and not blocked and not challenge
        if http_ok and not force_browser:
            return page
        # A page that already loaded does not need a paid scrape. force_browser
        # still opens Chromium for the newsroom home page, below.
        want_firecrawl = firecrawl_key() is not None if use_firecrawl is None else use_firecrawl
        if want_firecrawl and firecrawl_key() and not http_ok:
            try:
                scraped = _from_firecrawl(url, timeout)
            except RuntimeError:
                raise
            except Exception as exc:
                scraped = None
                if not page.emails:
                    page.error = f"firecrawl failed: {exc}"
            if scraped and (scraped.emails or scraped.text_len > page.text_len):
                if scraped.emails or not (use_chromium and chromium):
                    return scraped
                page = scraped
        if not use_chromium or not chromium:
            if http_error and not page.emails:
                page.error = http_error
            elif blocked and not page.emails:
                page.error = f"HTTP {status}"
            return page
        try:
            rendered = _chromium_dump(url, chromium)
        except RuntimeError as exc:
            if not page.emails:
                page.error = str(exc)
            return page
        rendered_page = _evidence_from_html(url, final, status, rendered, "chromium")
        if force_browser and rendered_page.text_len >= page.text_len:
            return rendered_page
        if len(rendered_page.emails) >= len(page.emails):
            return rendered_page
        return page
    finally:
        if own_client:
            http.close()


def _looks_like_pdf(url: str, response: httpx.Response) -> bool:
    ctype = response.headers.get("content-type", "").lower()
    if "pdf" in ctype or url.lower().split("?", 1)[0].endswith(".pdf"):
        return response.content[:5] == b"%PDF-" or "pdf" in ctype
    return response.content[:5] == b"%PDF-"


def search_same_site(
    query: str,
    host: str,
    *,
    limit: int = 4,
    timeout: float = 20,
    use_firecrawl: bool | None = None,
) -> list[str]:
    """Find more pages on a publisher's own site. Failure returns nothing."""
    want_firecrawl = firecrawl_key() is not None if use_firecrawl is None else use_firecrawl
    if want_firecrawl and firecrawl_key():
        fc_query = query
        if fc_query.lower().startswith("site:"):
            fc_query = fc_query.split(None, 1)[1] if " " in fc_query else "contact editorial email"
        try:
            found = firecrawl_search(fc_query, host, limit=limit, timeout=max(timeout, 30))
        except RuntimeError:
            raise
        except Exception:
            found = []
        if found:
            return found
    try:
        response = httpx.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers={"User-Agent": UA, "Accept": "text/html"},
            timeout=timeout,
            follow_redirects=True,
        )
        response.raise_for_status()
    except httpx.HTTPError:
        return []
    soup = BeautifulSoup(response.text, "html.parser")
    found: list[str] = []
    seen: set[str] = set()
    want = host.lower().removeprefix("www.")
    for anchor in soup.select("a.result__a, a.result-link"):
        href = anchor.get("href") or ""
        target = _unwrap_ddg(href)
        if not target:
            continue
        link_host = urlsplit(target).netloc.lower().removeprefix("www.")
        if link_host != want and not link_host.endswith("." + want):
            continue
        if target in seen:
            continue
        seen.add(target)
        found.append(target)
        if len(found) >= limit:
            break
    return found


def _unwrap_ddg(href: str) -> str:
    if href.startswith("//"):
        href = "https:" + href
    parts = urlsplit(href)
    if "duckduckgo.com" in parts.netloc and parts.path.startswith("/l/"):
        target = parse_qs(parts.query).get("uddg", [""])[0]
        return unquote(target)
    if href.startswith("http"):
        return href
    return ""


def load_cache(path: Path) -> dict[str, PageEvidence]:
    if not path.exists():
        return {}
    cached: dict[str, PageEvidence] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        page = PageEvidence.from_json(json.loads(line))
        cached[page.url] = page
    return cached


def append_cache(path: Path, page: PageEvidence) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(page.to_json(), ensure_ascii=False) + "\n")
