# AI search grounding check

Measure whether **Google AI Overviews**, OpenAI web search, and Perplexity cite our distribution network.

**Positive citation hosts**

- `newsworthy.ai`
- `citybuzz.co`
- `streetinsider.com`
- `finance.yahoo.com` (and `yahoo.com/finance/...`)

## Setup

1. Create the results table (you run this):

```bash
psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-26-release-grounding.sql
```

2. Env (Bun loads repo-root `.env` / `.env.local`):

| Env | Purpose |
|-----|---------|
| `OPENAI_KEY` | **Required** for batch (`gpt-4o-mini` query invent + optional OpenAI search) |
| `SERPAPI_API_KEY` | **Google AI Overviews** via [SerpApi](https://serpapi.com/) |
| `PERPLEXITY_API_KEY` | Perplexity Sonar |
| `DIRECT_DATABASE_URL` | Fraction DB |
| `SERPAPI_GL` | optional country (`us` default) |

> Google path uses **SerpApi Google Search + AI Overview**, not the Gemini API. That matches what customers see in Search.

## Batch job (releases 12h–72h old)

```bash
bun workers/grounding_check/run_batch.ts
bun workers/grounding_check/run_batch.ts --limit 10 --dry-run
bun workers/grounding_check/run_batch.ts --providers google,openai,perplexity
```

(`google` is an alias for `google_ai_overview`.)

For each eligible release:

1. **Google AI Overview** searches the **release title** from the DB (what customers type)  
2. OpenAI / Perplexity use a `gpt-4o-mini` distinctive query from title/abstract/body  
3. For each provider, skip only if that source already has `(pr_id, grounding_source, grounding_query)`  
4. Run **all** configured providers and report each (HIT / miss / skip)  
5. On success **per provider**, insert into `release_grounding`

If you already created the old unique index on `(pr_id, grounding_query)`, also run:

```bash
psql "$DIRECT_DATABASE_URL" -f apps/dashboard/drizzle/manual/2026-08-26-release-grounding-per-source.sql
```

Failures are not stored (so a later run can retry that provider).

## Manual probe

```bash
bun workers/grounding_check/test_grounding.ts \
  --query 'Essential Estate Planning for Texans Avoid DIY Pitfalls' \
  --providers google
```

## Table

See `apps/dashboard/drizzle/manual/2026-08-26-release-grounding.sql`.
