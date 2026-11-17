"""Command line for the pitch-list tool.

pitchlist run reads a newsroom URL, asks one model which publisher pages to open,
fetches those pages, and writes a CSV. A row is kept only when the address was
extracted from the publisher page named in email_published_on. The model cannot
fill a short list by guessing.
"""

from __future__ import annotations

import csv
import shutil
from pathlib import Path
from typing import Annotated
from urllib.parse import urlsplit

import typer
from rich.console import Console

from media_lists import __version__
from media_lists.fetch import fetch_page
from media_lists.firecrawl import api_key as firecrawl_key
from media_lists.emails import decode_cf
from media_lists.llm import Model, ModelConfig
from media_lists.db import default_db_path, outlet_rows, store_list
from media_lists.pipeline import Runner
from media_lists.schema import COLUMNS

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="Build a media pitch list from a newsroom URL. Addresses come from publisher pages, not from guesses.",
)
console = Console()
HUNTER_CACHE = Path(__file__).resolve().parents[1] / ".cache" / "hunter"

hunter_app = typer.Typer(no_args_is_help=True, help="Manual Hunter.io lookups and credit balance.")
app.add_typer(hunter_app, name="hunter")


def _hunter(budget: float):
    from media_lists.hunter import Hunter, api_key as hunter_key

    key = hunter_key()
    if not key:
        console.print("[red]Set HUNTER_API_KEY in the repo root .env.local[/red]")
        raise typer.Exit(code=2)
    return Hunter(key, cache_dir=HUNTER_CACHE, budget=budget)


@hunter_app.command("credits")
def hunter_credits() -> None:
    """Show the Hunter.io plan and credits left this month (free)."""
    client = _hunter(0)
    try:
        data = client.account()
    finally:
        client.close()
    credits = (data.get("requests") or {}).get("credits") or {}
    console.print(
        f"{data.get('plan_name')}: {credits.get('used', 0):g} of {credits.get('available', 0):g} credits used, "
        f"resets {data.get('reset_date')}"
    )


@hunter_app.command("outlet")
def hunter_outlet(
    domain: Annotated[str, typer.Argument(help="Publication domain, e.g. bevnet.com.")],
    found_only: Annotated[bool, typer.Option("--found-only", help="Only addresses Hunter saw published.")] = False,
) -> None:
    """List editorial contacts Hunter.io has for a publication (about 1 credit; cached)."""
    client = _hunter(2)
    try:
        counts = client.email_count(domain)
        contacts = client.editorial_contacts(domain, found_only=found_only, limit=10)
    finally:
        client.close()
    console.print(f"{domain}: {counts.get('total', 0)} addresses, "
                  f"{(counts.get('department') or {}).get('communication', 0)} in communication")
    for c in contacts:
        status = f"{c.verification or 'unverified'} {c.verified_on[:10]}".strip()
        console.print(f"  {c.name or '(desk)'} | {c.position or '-'} | {c.email} | {status} | "
                      f"{'seen published' if c.found else 'pattern-inferred'} | confidence {c.confidence}")
    console.print(f"{client.spent:g} credits used")


@hunter_app.command("find")
def hunter_find(
    name: Annotated[str, typer.Argument(help="Journalist's full name.")],
    domain: Annotated[str, typer.Argument(help="Publication domain, e.g. bevnet.com.")],
    verify: Annotated[bool, typer.Option("--verify/--no-verify", help="Verify the address if Hunter's last check is old.")] = True,
) -> None:
    """Find one journalist's address with Email Finder (1 credit if found, +0.5 to verify)."""
    first, _, last = name.strip().partition(" ")
    if not last:
        raise typer.BadParameter("Give a first and last name")
    client = _hunter(1.5)
    try:
        found = client.email_finder(domain, first, last)
        if found and verify:
            client.confirm_valid(found)
    finally:
        client.close()
    if not found:
        console.print(f"No address found for {name} at {domain} (no credit charged)")
    else:
        console.print(f"{found.email} | {found.position or '-'} | {found.verification or 'unverified'} "
                      f"{found.verified_on[:10]} | {'seen published' if found.found else 'pattern-inferred'} | "
                      f"confidence {found.confidence}")
    console.print(f"{client.spent:g} credits used")


def _slug(url: str) -> str:
    parts = urlsplit(url)
    host = parts.netloc.lower().removeprefix("www.")
    path = parts.path.strip("/").replace("/", "-")
    raw = f"{host}-{path}" if path else host
    safe = "".join(char.lower() if char.isalnum() else "-" for char in raw)
    while "--" in safe:
        safe = safe.replace("--", "-")
    return safe.strip("-")[:80] or "newsroom"


def _chromium(explicit: str | None, enabled: bool) -> str | None:
    if not enabled:
        return None
    if explicit:
        return explicit
    return shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")


def _model(model: str | None, base_url: str | None) -> Model:
    try:
        config = ModelConfig.from_env(model=model, base_url=base_url)
    except RuntimeError as exc:
        raise typer.BadParameter(str(exc)) from exc
    console.print(f"Model {config.model} at {config.base_url}")
    return Model(config)


@app.callback(invoke_without_command=True)
def main_callback(
    ctx: typer.Context,
    version: Annotated[bool, typer.Option("--version", help="Print the version and exit.")] = False,
) -> None:
    if version:
        console.print(__version__)
        raise typer.Exit()
    if ctx.invoked_subcommand is None:
        console.print(ctx.get_help())
        raise typer.Exit(code=1)


@app.command()
def run(
    newsroom_url: Annotated[str, typer.Argument(help="Newsroom URL. A Newsworthy newsroom page works.")],
    out: Annotated[Path | None, typer.Option("--out", "-o", help="Also write the list to this CSV (optional).")] = None,
    work: Annotated[
        Path | None,
        typer.Option("--work", help="Directory for the brief, page cache, and drop report."),
    ] = None,
    min_rows: Annotated[int, typer.Option("--min", min=1, help="Aim for at least this many. Do not pad if you fall short.")] = 35,
    max_rows: Annotated[int, typer.Option("--max", min=1, help="Keep the best this many, ranked by fit.")] = 50,
    per_outlet: Annotated[int, typer.Option("--per-outlet", min=1, max=5, help="Most journalists from one outlet (different beats).")] = 2,
    max_pages: Annotated[int, typer.Option("--max-pages", min=1, help="Publisher pages to open before the extra round.")] = 80,
    workers: Annotated[int, typer.Option("--workers", min=1, max=8)] = 3,
    timeout: Annotated[float, typer.Option("--timeout", min=5)] = 20,
    model: Annotated[str | None, typer.Option("--model", help="Overrides MEDIA_LIST_MODEL.")] = None,
    base_url: Annotated[str | None, typer.Option("--base-url", help="OpenAI-compatible API base URL.")] = None,
    chromium: Annotated[str | None, typer.Option("--chromium", help="Browser binary. Default: chromium on PATH.")] = None,
    no_chromium: Annotated[bool, typer.Option("--no-chromium", help="Do not open a browser when HTTP is blocked.")] = False,
    no_search: Annotated[bool, typer.Option("--no-search", help="Do not search for more pages on a site that printed no address.")] = False,
    no_firecrawl: Annotated[bool, typer.Option("--no-firecrawl", help="Do not use Firecrawl when a page is blocked.")] = False,
    no_recheck: Annotated[bool, typer.Option("--no-recheck", help="Skip the second fetch of each kept page.")] = False,
    refresh: Annotated[bool, typer.Option("--refresh", help="Ignore the page cache in the work directory.")] = False,
    db: Annotated[Path | None, typer.Option("--db", help="SQLite file. Default: media.sqlite in this project.")] = None,
    no_db: Annotated[bool, typer.Option("--no-db", help="Write the CSV only. Do not update the outlet database.")] = False,
    hunter: Annotated[bool, typer.Option("--hunter/--no-hunter", help="Use Hunter.io for planned outlets where no address was found. On when HUNTER_API_KEY is set.")] = True,
    hunter_budget: Annotated[float, typer.Option("--hunter-budget", min=0, help="Most Hunter.io credits this run may spend.")] = 100,
    hunter_found_only: Annotated[bool, typer.Option("--hunter-found-only", help="Keep only addresses Hunter saw published, not pattern-inferred ones.")] = False,
    publish_after: Annotated[bool, typer.Option("--publish/--no-publish", help="Publish to the brand's Newsworthy Curated list when done. --no-publish only researches (saved to media.sqlite; use publish later).")] = True,
    force: Annotated[bool, typer.Option("--force", help="Publish even if the brand has fewer than 3 distributed releases.")] = False,
    crawl_newsroom: Annotated[bool, typer.Option("--crawl-newsroom", help="Crawl the newsroom page instead of reading the brand's releases from the database.")] = False,
    hunter_preview: Annotated[bool, typer.Option("--hunter-preview", help="Show what Hunter.io has for the empty outlets using free calls only. Adds no contacts.")] = False,
) -> None:
    """Fetch a newsroom, crawl publisher pages, and write the pitch list.

    Outlets where the publisher's pages printed no usable address can be filled
    from Hunter.io (HUNTER_API_KEY in the repo root .env.local). Hunter
    addresses are kept only when verified valid, and are marked in notes.

    Set MEDIA_LIST_API_KEY, or one of XAI_API_KEY, OPENAI_API_KEY, or
    DEEPSEEK_API_KEY. MEDIA_LIST_BASE_URL and MEDIA_LIST_MODEL override the
    provider defaults. FIRECRAWL_API_KEY is used when a publisher page is
    blocked or empty. A short list is written as-is. The tool does not invent
    addresses to reach --min.
    """
    if max_rows < min_rows:
        raise typer.BadParameter("--max must be greater than or equal to --min")
    if not newsroom_url.startswith(("http://", "https://")):
        raise typer.BadParameter("The newsroom URL must start with http:// or https://")
    if publish_after and no_db:
        raise typer.BadParameter("Publishing needs the local database; drop --no-db or add --no-publish")
    if publish_after and not force:
        # Check eligibility before spending time and credits on research.
        from media_lists.publish import check_eligible, database_url

        try:
            brand, distributed = check_eligible(newsroom_url, db_url=database_url())
        except (LookupError, ValueError, RuntimeError) as exc:
            console.print(f"[red]{exc}[/red]")
            raise typer.Exit(code=1) from exc
        console.print(f"{brand}: {distributed} distributed releases. The list will be published when research finishes.")
    work_dir = work or Path.cwd() / "media-lists-work" / _slug(newsroom_url)
    browser = _chromium(chromium, enabled=not no_chromium)
    if not no_chromium and not browser:
        console.print("Chromium was not found. Blocked pages will be skipped. Install it or pass --no-chromium.")
    use_firecrawl = not no_firecrawl
    if use_firecrawl and firecrawl_key():
        console.print("Using Firecrawl when a page is blocked or a contact URL is missing.")
    elif use_firecrawl:
        console.print("FIRECRAWL_API_KEY is not set. Blocked pages use Chromium only.")
    hunter_client = None
    if hunter or hunter_preview:
        from media_lists.hunter import Hunter, api_key as hunter_key

        key = hunter_key()
        if key:
            hunter_client = Hunter(key, cache_dir=HUNTER_CACHE, budget=0 if hunter_preview else hunter_budget)
            console.print("Hunter.io preview: free calls only." if hunter_preview
                          else f"Using Hunter.io for empty outlets, up to {hunter_budget:g} credits.")
        else:
            console.print("HUNTER_API_KEY is not set. Skipping Hunter.io.")
    runner = Runner(
        model=_model(model, base_url),
        work=work_dir,
        out=out,
        chromium=browser,
        use_chromium=bool(browser),
        use_search=not no_search,
        use_firecrawl=use_firecrawl,
        recheck=not no_recheck,
        refresh=refresh,
        workers=workers,
        timeout=timeout,
        min_rows=min_rows,
        max_rows=max_rows,
        max_pages=max_pages,
        db=None if no_db else (db or default_db_path()),
        console=console,
        hunter=hunter_client,
        hunter_found_only=hunter_found_only,
        hunter_preview=hunter_preview,
        newsroom_from_db=not crawl_newsroom,
        max_per_outlet=per_outlet,
    )
    try:
        rows, _dropped = runner.run(newsroom_url)
    except (RuntimeError, OSError) as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=1) from exc
    finally:
        if hunter_client is not None:
            hunter_client.close()
        from media_lists.usage import USAGE

        for line in USAGE.summary_lines():
            console.print(line)
    if not rows:
        raise typer.Exit(code=2)
    if publish_after:
        if no_db:
            console.print("[red]--publish needs the local database; drop --no-db[/red]")
            raise typer.Exit(code=1)
        publish(newsroom_url, db=db, prune=False, dry_run=False, force=force)


@app.command()
def brief(
    newsroom_url: Annotated[str, typer.Argument(help="Newsroom URL.")],
    model: Annotated[str | None, typer.Option("--model")] = None,
    base_url: Annotated[str | None, typer.Option("--base-url")] = None,
    chromium: Annotated[str | None, typer.Option("--chromium")] = None,
    no_chromium: Annotated[bool, typer.Option("--no-chromium")] = False,
) -> None:
    """Print the client brief and stop. No crawl and no CSV."""
    from media_lists.newsroom import collect_newsroom

    browser = _chromium(chromium, enabled=not no_chromium)
    text, _page = collect_newsroom(
        newsroom_url,
        chromium=browser,
        use_chromium=bool(browser),
        timeout=20,
    )
    parsed = _model(model, base_url).brief(text)
    console.print_json(parsed.model_dump_json())


@app.command()
def fetch(
    url: Annotated[str, typer.Argument(help="One publisher page.")],
    chromium: Annotated[str | None, typer.Option("--chromium")] = None,
    no_chromium: Annotated[bool, typer.Option("--no-chromium")] = False,
) -> None:
    """Print the addresses found on one page."""
    browser = _chromium(chromium, enabled=not no_chromium)
    page = fetch_page(url, chromium=browser, use_chromium=bool(browser))
    console.print(f"{page.status} {page.final_url or url} via {page.fetch_method or 'none'}")
    if page.error:
        console.print(page.error)
    if not page.emails:
        console.print("No address found.")
        raise typer.Exit(code=2)
    for item in page.emails:
        console.print(f"{item.address} ({item.method}) {item.context[:180]}", markup=False)


@app.command()
def decode(
    encoded: Annotated[str, typer.Argument(help="Cloudflare email-protection hex string.")],
) -> None:
    """Decode a Cloudflare email-protection hash."""
    try:
        console.print(decode_cf(encoded))
    except ValueError as exc:
        raise typer.BadParameter(str(exc)) from exc


def _database(path: Path | None) -> Path:
    return path or default_db_path()


@app.command()
def load(
    csv_path: Annotated[Path, typer.Argument(help="An existing pitch-list CSV.")],
    newsroom_url: Annotated[str, typer.Option("--newsroom", help="Newsroom this list was built from.")],
    client: Annotated[str, typer.Option("--client", help="Client name stored on the list.")] = "",
    db: Annotated[Path | None, typer.Option("--db", help="SQLite file. Default: media.sqlite in this project.")] = None,
) -> None:
    """Load a pitch-list CSV into the outlet database and classify each outlet."""
    if not newsroom_url.startswith(("http://", "https://")):
        raise typer.BadParameter("The newsroom URL must start with http:// or https://")
    if not csv_path.is_file():
        raise typer.BadParameter(f"No such file: {csv_path}")
    with csv_path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = [name for name in COLUMNS if name not in (reader.fieldnames or [])]
        if missing:
            raise typer.BadParameter("CSV is missing columns: " + ", ".join(missing))
        rows = list(reader)
    database = _database(db)
    list_id = store_list(
        database,
        newsroom_url=newsroom_url,
        client_name=client,
        csv_path=str(csv_path.resolve()),
        rows=rows,
    )
    console.print(f"List {list_id}: {len(rows)} contacts saved in {database}")


@app.command()
def outlets(
    db: Annotated[Path | None, typer.Option("--db", help="SQLite file. Default: media.sqlite in this project.")] = None,
    industry: Annotated[str, typer.Option("--industry", help="Show only this industry.")] = "",
    vertical: Annotated[str, typer.Option("--vertical", help="Show only this vertical.")] = "",
    section: Annotated[str, typer.Option("--section", help="Show only this section.")] = "",
) -> None:
    """Print outlets and the industry, vertical, and section stored for each."""
    from rich.table import Table

    database = _database(db)
    if not database.exists():
        console.print(f"No database at {database}")
        raise typer.Exit(code=2)
    found = outlet_rows(database, industry=industry, vertical=vertical, section=section)
    table = Table(title=str(database))
    for column in ("Outlet", "Industry", "Vertical", "Section", "Contacts"):
        table.add_column(column)
    for row in found:
        table.add_row(row["name"], row["industry"], row["vertical"], row["section"], str(row["contacts"]))
    console.print(table)
    console.print(f"{len(found)} outlets")


@app.command()
def publish(
    newsroom_url: Annotated[str, typer.Argument(help="Newsworthy newsroom URL, e.g. https://www.newsworthy.ai/newsroom/<slug>.")],
    db: Annotated[Path | None, typer.Option("--db", help="SQLite file. Default: media.sqlite in this project.")] = None,
    prune: Annotated[bool, typer.Option("--prune", help="Also remove journalists from the curated list that are not in this research.")] = False,
    dry_run: Annotated[bool, typer.Option("--dry-run", help="Run everything, then roll back. Nothing is saved.")] = False,
    force: Annotated[bool, typer.Option("--force", help="Publish even if the brand has fewer than 3 distributed releases.")] = False,
) -> None:
    """Publish this newsroom's contacts to the brand's Newsworthy Curated list on Supabase.

    Run per customer request, once the brand has at least 3 distributed press releases.
    """
    from media_lists.publish import database_url, load_contacts, publish as publish_list

    database = _database(db)
    if not database.exists():
        console.print(f"No database at {database}")
        raise typer.Exit(code=2)
    try:
        client, contacts = load_contacts(database, newsroom_url)
        if not contacts:
            console.print("No contacts with an email address to publish.")
            raise typer.Exit(code=1)
        result = publish_list(newsroom_url, contacts, db_url=database_url(), prune=prune, dry_run=dry_run, force=force)
    except (LookupError, ValueError, RuntimeError) as exc:
        console.print(f"[red]{exc}[/red]")
        raise typer.Exit(code=1)

    prefix = "[yellow]Dry run, rolled back:[/yellow] " if dry_run else ""
    console.print(
        f"{prefix}{result.company_name} (company {result.company_id}): "
        f"{result.distributed_releases} distributed releases; {result.contacts} contacts from {client or 'stored lists'} -> Newsworthy Curated list {result.list_id}"
        f"{' (created)' if result.list_created else ''}"
    )
    console.print(
        f"  {result.added_to_list} added to the list, {result.contacts - result.added_to_list} already on it, "
        f"{result.new_journalists} new journalists"
        + (f", {result.pruned} removed" if prune else "")
    )


def main() -> None:
    app()
