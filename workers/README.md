# Media list research workers

Build and maintain verified media outreach lists for Newsworthy newsrooms.

The agent uses **Grok 4.5** (xAI) + **Firecrawl** + **Hunter.io**, writes CSVs under `lists/`, and can cache journalists in the **fraction** Postgres DB so repeat research does not re-spend Firecrawl/Hunter credits.

It looks for:

- Journalists / editors (trade + consumer)
- Podcasters / hosts
- Bloggers / newsletter writers
- Influencers / creators (with a verifiable identity and contact path)

---

## 1. One-time setup

```bash
cd workers
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `workers/.env`:

| Variable | Required | Purpose |
|----------|----------|---------|
| `XAI_API_KEY` | yes | xAI / Grok API key |
| `XAI_MODEL` | no | default `grok-4.5` |
| `XAI_BASE_URL` | no | default `https://api.x.ai/v1` |
| `HUNTER_IO_API` | yes for email enrichment | [Hunter.io API key](https://hunter.io/api-keys) |
| `FIRECRAWL_API_KEY` | no if CLI logged in | Firecrawl API fallback |

Also available from the repo root `.env.local` (loaded automatically):

| Variable | Purpose |
|----------|---------|
| `DIRECT_DATABASE_URL` | Fraction DB for journalist lookup cache |
| `DATABASE_URL` | fallback if direct URL is unset |

**Firecrawl:** the `firecrawl` CLI should be on your `PATH` (preferred). Otherwise set `FIRECRAWL_API_KEY`.

**Optional DB cache** (recommended — skips repeat Firecrawl/Hunter for known people):

```bash
# From repo root, using fraction connection
psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-08-14-media-list-journalists.sql
```

---

## 2. Run a media list (main command)

```bash
cd workers
source .venv/bin/activate

# Create or incrementally update lists/<slug>.csv
./run_media_list.sh https://www.newsworthy.ai/newsroom/santos-muscle-nutrition

# Same without the wrapper
python -m media_list_agent https://www.newsworthy.ai/newsroom/santos-muscle-nutrition

# Deeper pass (more tool turns)
python -m media_list_agent https://www.newsworthy.ai/newsroom/green-choice-proteins --max-turns 50

# Custom output path
python -m media_list_agent https://www.newsworthy.ai/newsroom/santos-muscle-nutrition \
  -o /tmp/santos-test.csv
```

A full research pass usually needs **~25–50 turns** (several minutes).

### What happens on each run

1. Derives slug from the newsroom URL → `lists/{slug}.csv`
2. Loads the existing CSV if present (**incremental** — does not wipe the list)
3. Scrapes newsroom + PRs, searches for journalists / podcasts / blogs / influencers
4. Calls `lookup_journalist` against the DB cache when available (reuse if `updated_at` &lt; 60 days)
5. Enriches with Hunter.io where needed
6. Writes the merged CSV and upserts people into `media_list_journalists`

---

## 3. Lists on disk

All brand CSVs live in **`workers/lists/`**:

| Newsroom | CSV |
|----------|-----|
| `.../newsroom/green-choice-proteins` | `lists/green-choice-proteins.csv` |
| `.../newsroom/santos-muscle-nutrition` | `lists/santos-muscle-nutrition.csv` |
| `.../newsroom/tnt-true-nutrition-technology` | `lists/tnt-true-nutrition-technology.csv` |

### CSV columns

```
Journalist, Email, Email_Type, Publication, Outlet_Type, Role, Theme_Fit,
Example_Coverage_URL, Notes,
Hunter_Email, Hunter_Score, Hunter_Verification, Hunter_Domain,
Hunter_Company, Hunter_Status, Hunter_Source_URL
```

- **`Email` / `Email_Type`** — only crawled mailto or published desk addresses (never guessed)
- **`Hunter_*`** — Hunter.io Email Finder results (kept separate from crawled email)
- **`Outlet_Type`** — e.g. Trade, Podcast, Blog, Newsletter, Influencer / YouTube

---

## 4. Hunter.io enrichment (CSV only)

Use when you want to fill/refresh Hunter fields without a full Grok research pass:

```bash
cd workers
source .venv/bin/activate

# All lists
python -m media_list_agent --enrich-hunter

# One list
python -m media_list_agent --enrich-hunter lists/santos-muscle-nutrition.csv

# Force re-query even if Hunter_* already set
python -m media_list_agent --enrich-hunter --force-hunter
```

Results are cached under `workers/.cache/hunter/` so identical lookups are not re-billed.

---

## 5. Journalist DB cache (fraction)

Table: `media_list_journalists` — **one row per journalist** (`name_key` unique).

### Create table (you run migrations)

```bash
psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-08-14-media-list-journalists.sql
```

### Backfill from existing CSVs

```bash
cd workers
source .venv/bin/activate
python -m media_list_agent --backfill-db

# Or specific files
python -m media_list_agent --backfill-db lists/green-choice-proteins.csv lists/santos-muscle-nutrition.csv
```

### Freshness rule

| Condition | Behavior |
|-----------|----------|
| Row exists and `updated_at` &lt; **60 days** | Reuse Email / Hunter fields — skip Firecrawl/Hunter for that person |
| Missing or older than 60 days | Research / Hunter again, then upsert and bump `updated_at` |

---

## 6. Typical full workflow

```bash
# A) Setup (once)
cd workers
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill XAI_API_KEY, HUNTER_IO_API

# B) Create DB cache table (once, from repo root)
psql "$DIRECT_DATABASE_URL" -f workers/sql/2026-08-14-media-list-journalists.sql

# C) Research a brand newsroom
./run_media_list.sh https://www.newsworthy.ai/newsroom/santos-muscle-nutrition --max-turns 40

# D) If you already had CSVs before Hunter/DB existed:
python -m media_list_agent --enrich-hunter
python -m media_list_agent --backfill-db

# E) Later: re-run the same newsroom URL anytime for incremental updates
./run_media_list.sh https://www.newsworthy.ai/newsroom/santos-muscle-nutrition
```

---

## 7. CLI reference

```text
python -m media_list_agent <newsroom_url>
python -m media_list_agent <newsroom_url> -o PATH --max-turns N

python -m media_list_agent --enrich-hunter [CSV ...]
python -m media_list_agent --enrich-hunter --force-hunter

python -m media_list_agent --backfill-db [CSV ...]
```

Or: `./run_media_list.sh` → same as `python -m media_list_agent` using the local `.venv`.

---

## 8. Project layout

```text
workers/
  .env                 # secrets (not committed)
  .env.example
  requirements.txt
  run_media_list.sh
  README.md
  lists/               # brand CSVs (source of truth per newsroom)
  sql/                 # manual fraction SQL (you apply these)
  media_list_agent/    # Python package
    __main__.py
    __init__.py        # Grok agent loop + CLI
    hunter.py          # Hunter.io client
    db.py              # media_list_journalists lookup/upsert
  .cache/              # Firecrawl + Hunter disk cache (gitignored)
  .venv/               # local virtualenv (gitignored)
```

---

## 9. Notes / limits

- Names and emails are **never invented** — only verified crawl or Hunter results.
- Hunter Email Finder does **not** charge when no email is found.
- Overlapping people across brand lists share one DB row (`name_key`); `source_lists` records which CSVs contributed.
- Do not commit `.env`, `.venv/`, or `.cache/`.
