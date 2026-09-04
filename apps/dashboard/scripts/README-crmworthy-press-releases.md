# CRMWorthy press-release backfill

Backfills approved press releases into CRMWorthy (`POST /api/v1/press-releases`).

**Eligible releases:** status `approved` or `sent`, with `release_at`, `slug`, and owner `users.uuid`.

## Contact identity (same as spend / delete)

Omit `contactId`. Identify the contact with your system ID:

```bash
curl -X POST https://crmworthy.com/api/v1/press-releases \
  -H "Authorization: Bearer crmw_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "releaseId": 20260917,
    "releaseUrl": "https://www.newsworthy.ai/news/…",
    "reportingUrl": "https://app.newsworthyai.com/pr/clipsreport/…",
    "releaseDate": "2026-09-03",
    "sourceName": "newsworthy.ai",
    "sourceId": "<users.uuid>"
  }'
```

| Field | Value |
|-------|--------|
| `sourceName` | `newsworthy.ai` (must match imported contacts; lowercase) |
| `sourceId` | `users.uuid` |

Do **not** send `users.uuid` as `contactId` — that field is CRMWorthy’s internal id.

**Pace:** 1 second between POSTs.

**Env:** `DIRECT_DATABASE_URL` (or `DATABASE_URL`) and `CRMWORTHY_API_KEY` (must start with `crmw_`).

Run from `apps/dashboard`. Doppler `prd` may fall back to monorepo `.env.local` for DB/API key.

## Dry run

```bash
cd apps/dashboard

doppler run --project newsworthy-dashboard --config prd -- \
  bun scripts/backfill-crmworthy-press-releases.ts --dry-run --limit 5
```

## Full backfill

```bash
cd apps/dashboard

doppler run --project newsworthy-dashboard --config prd -- \
  bun scripts/backfill-crmworthy-press-releases.ts
```

## Options

| Flag | Meaning |
|------|---------|
| `--dry-run` | Print payloads only; no CRMWorthy writes |
| `--limit N` | Process only the first N eligible releases |
| `--since YYYY-MM-DD` | Only releases with `release_at` on/after this date |
| `--after-id ID` | Resume: only release ids greater than `ID` |

```bash
# Resume
doppler run --project newsworthy-dashboard --config prd -- \
  bun scripts/backfill-crmworthy-press-releases.ts --after-id 4
```
