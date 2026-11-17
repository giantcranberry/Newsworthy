"""Pull the newsroom page and the release pages it links to."""

from __future__ import annotations

from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from media_lists.fetch import PageEvidence, fetch_page
from media_lists.schema import host_of


def release_links(html: str, page_url: str, *, limit: int = 8) -> list[str]:
    soup = BeautifulSoup(html or "", "html.parser")
    base = urlsplit(page_url)
    prefix = base.path.rstrip("/")
    host = host_of(page_url)
    found: list[str] = []
    seen = {page_url.rstrip("/")}
    for anchor in soup.find_all("a", href=True):
        href = urljoin(page_url, anchor["href"].strip())
        parts = urlsplit(href)
        if parts.scheme not in {"http", "https"}:
            continue
        if host_of(href) != host:
            continue
        path = parts.path.rstrip("/")
        if prefix and not path.startswith(prefix):
            continue
        if path == prefix or len(path) <= len(prefix) + 1:
            continue
        clean = parts._replace(fragment="", query="").geturl().rstrip("/")
        if clean in seen:
            continue
        seen.add(clean)
        found.append(clean)
        if len(found) >= limit:
            break
    return found


def collect_newsroom(
    url: str,
    *,
    chromium: str | None,
    use_chromium: bool,
    timeout: float,
    release_limit: int = 6,
) -> tuple[str, PageEvidence]:
    home = fetch_page(
        url,
        chromium=chromium,
        use_chromium=use_chromium,
        force_browser=use_chromium,
        timeout=timeout,
    )
    if home.error and not home.text and not home.html:
        raise RuntimeError(f"could not read the newsroom: {home.error}")
    chunks = [_chunk(home)]
    for link in release_links(home.html, home.final_url or url, limit=release_limit):
        page = fetch_page(link, chromium=chromium, use_chromium=use_chromium, timeout=timeout)
        if page.text:
            chunks.append(_chunk(page))
    text = "\n\n".join(chunks)
    return text[:28000], home


def _chunk(page: PageEvidence) -> str:
    body = page.text[:8000]
    return f"URL: {page.final_url or page.url}\nTitle: {page.title}\n{body}"


def collect_from_database(newsroom_url: str, *, release_limit: int = 8, per_release: int = 3500) -> str | None:
    """Newsroom text from Supabase instead of crawling newsworthy.ai.

    Returns the brand profile, its PR contacts (so the brief can exclude them),
    and its most recent distributed releases (status 'sent') as plain text, or
    None if the URL isn't a Newsworthy newsroom, the brand isn't found, or it
    has no distributed releases.
    """
    import psycopg

    from media_lists.publish import database_url, newsroom_slug

    try:
        slug = newsroom_slug(newsroom_url)
    except ValueError:
        return None
    with psycopg.connect(database_url(), autocommit=True, prepare_threshold=None) as conn:
        conn.read_only = True
        brand = conn.execute(
            """
            SELECT id, company_name, nr_title, nr_desc, website, email, city, state, country_code
            FROM company WHERE lower(nr_uri) = %s AND is_deleted IS NOT TRUE
            """,
            (slug,),
        ).fetchall()
        if len(brand) != 1:
            return None
        company_id, name, nr_title, nr_desc, website, email, city, state, country = brand[0]
        contacts = conn.execute(
            "SELECT name, title, email FROM contact WHERE company_id = %s AND is_deleted IS NOT TRUE",
            (company_id,),
        ).fetchall()
        releases = conn.execute(
            """
            SELECT title, released_at, location, abstract, body, slug
            FROM releases
            WHERE company_id = %s AND status = 'sent' AND is_deleted IS NOT TRUE
            ORDER BY released_at DESC NULLS LAST, id DESC
            LIMIT %s
            """,
            (company_id, release_limit),
        ).fetchall()
    if not releases:
        return None

    lines = [
        f"URL: {newsroom_url}",
        f"Company: {name}",
        f"Newsroom title: {nr_title or ''}",
        f"About: {BeautifulSoup(nr_desc or '', 'html.parser').get_text(' ', strip=True)}",
        f"Website: {website or ''}",
        f"Company email: {email or ''}",
        f"Location: {', '.join(x for x in (city, state, country) if x)}",
        "PR contacts (the client's own people; never pitch these):",
        *[f"- {c_name} ({c_title or ''}) {c_email or ''}" for c_name, c_title, c_email in contacts],
    ]
    chunks = ["\n".join(lines)]
    for title, released_at, location, abstract, body, rel_slug in releases:
        text = BeautifulSoup(body or "", "html.parser").get_text(" ", strip=True)
        chunks.append(
            f"Press release: {title or ''}\n"
            f"Released: {released_at.date() if released_at else ''}  Location: {location or ''}\n"
            f"Summary: {abstract or ''}\n{text[:per_release]}"
        )
    return "\n\n".join(chunks)[:28000]
