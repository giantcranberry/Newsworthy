# media-lists (`pitchlist`)

Builds a **Newsworthy Curated** media list for a brand from its Newsworthy newsroom.
Run offline by staff, per customer request, once the brand has **at least 3
distributed press releases**.

Addresses come from publisher pages first. For planned outlets where those pages
printed no usable address, Hunter.io can fill the gap (verified-valid addresses
only, marked as Hunter-sourced). A contact without an email is never published.

## Setup

Run from this folder (`-e .` in requirements.txt installs the `pitchlist`
command itself, editable):

```sh
cd typer/media-lists
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# or: uv venv && uv pip install -r requirements.txt
```

`.env` in this folder: `XAI_API_KEY` (or `MEDIA_LIST_API_KEY` / `OPENAI_API_KEY`),
optional `FIRECRAWL_API_KEY`. `publish` reads `DIRECT_DATABASE_URL` (Supabase)
and `HUNTER_API_KEY` from the repo root `.env.local`. Chromium on `PATH` helps
with blocked pages.

## Building a list for a customer

One command researches the brand and publishes to its Newsworthy Curated list:

```sh
.venv/bin/pitchlist run https://www.newsworthy.ai/newsroom/<slug>
```

It first checks the brand has at least 3 distributed releases (`--force`
overrides), so an ineligible brand doesn't use any research time or credits.

Options: `-o lists/<slug>.csv` also writes a CSV; `--no-publish` researches
only (saved to `media.sqlite`, publish later with
`pitchlist publish <url> [--dry-run] [--prune]`).

The list aims for the best 35-50 journalists (`--min 35 --max 50`): every
contact gets a 1-5 fit score and the list is trimmed to the top `--max`. Up to
two journalists per outlet on different beats (`--per-outlet 2`). Re-running is
cheap: fetched pages and Hunter results are cached, and publishing only adds
(`publish --prune` removes journalists who dropped out).

### What `run` does

1. Reads the brand and its 8 most recent distributed releases from the releases
   database (crawls the newsroom page only if that fails, or with
   `--crawl-newsroom`), and has the model write a brief
   (client, product, themes) — `brief.json`.
2. Has the model propose publisher pages likely to list editors and their
   addresses (masthead, contact, staff, author pages) — `plan.json`.
3. Fetches those pages (HTTP, then Chromium or Firecrawl if blocked; decodes
   Cloudflare-protected emails) and searches the same sites for more pages where
   none had an address.
4. Has the model judge each page: which addresses on it are a fitting editor,
   reporter, or desk for this brand, and why — `decisions.json`.
5. Keeps only addresses actually found on the page cited, dropping the brand's
   own domains, aggregators (Muck Rack, ZoomInfo, ...) and duplicates. If short
   of `--min` (default 50), it crawls one more round, then stops rather than pad.
6. Re-fetches each kept page to confirm the address is still there.
7. **Hunter.io fallback** (when `HUNTER_API_KEY` is set): for each planned outlet
   that still has no contact, a Domain Search for editorial staff (editors,
   reporters, writers, producers; a news-desk inbox if no person), then the model
   picks the best fit per outlet and writes the pitch angle. An address is kept
   only if Hunter verified it `valid` in the last 90 days, or a fresh Email
   Verifier check says `valid`. These rows are marked in `notes` and published
   with `email_source = 'hunter'`.
8. Writes the CSV, saves it to `media.sqlite`, and writes `report.json`
   (including Hunter credits used).

### Hunter.io options for `run`

| Option | Effect |
|---|---|
| `--hunter-budget 100` | Most credits one run may spend (default 100) |
| `--hunter-found-only` | Only addresses Hunter saw published, never pattern-inferred |
| `--hunter-preview` | Free Email Count per empty outlet; adds no contacts |
| `--no-hunter` | Skip Hunter entirely |

Costs on the Starter plan (2,000 credits/month): Domain Search 1 credit, Email
Finder 1 if found, Verifier 0.5; Email Count and account checks are free.
Responses are cached in `.cache/hunter/`, so re-runs and other brands that
share an outlet don't pay again.

### Manual Hunter lookups

```sh
.venv/bin/pitchlist hunter credits                      # plan and credits left (free)
.venv/bin/pitchlist hunter outlet bevnet.com            # editorial staff at a publication (~1 credit)
.venv/bin/pitchlist hunter find "Jeff Klineman" bevnet.com   # one person's address (1 credit if found)
```

### What `publish` does

1. Finds the brand whose `company.nr_uri` matches the newsroom slug.
2. Refuses if the brand has fewer than 3 releases with `status = 'sent'`
   (`--force` overrides).
3. Creates the brand's Newsworthy Curated list (`pitch_groups.is_curated`) if
   it doesn't have one.
4. Adds or updates each contact in `curated_journalists` (one row per email,
   shared across brands) and links it to the list with the pitch angle as
   `theme_fit`.

In the dashboard the customer sees name and outlet only. They can select the
list when publishing, but can't edit, export, or see the emails. Each curated
journalist gets at most one release from that brand every 28 days.

## Other commands

`brief <url>` (brief only), `fetch <page>` (addresses on one page),
`decode <hex>` (Cloudflare email), `load <csv> --newsroom <url>` (import an
existing CSV into `media.sqlite`), `outlets` (stored outlets by industry).
