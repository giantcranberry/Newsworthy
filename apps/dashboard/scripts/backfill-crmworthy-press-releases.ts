/**
 * Backfill approved press releases into CRMWorthy (/api/v1/press-releases).
 *
 * Identifies the contact with sourceName + sourceId (users.uuid), NOT CRMWorthy's
 * internal contact.id. Waits 1s between POSTs.
 *
 * See: scripts/README-crmworthy-press-releases.md
 *
 * Usage (from apps/dashboard):
 *   doppler run --project newsworthy-dashboard --config prd -- \
 *     bun scripts/backfill-crmworthy-press-releases.ts [--dry-run] [--limit N] [--since YYYY-MM-DD] [--after-id ID]
 *
 * Env: DIRECT_DATABASE_URL (preferred) or DATABASE_URL, CRMWORTHY_API_KEY
 * Falls back to monorepo-root /.env.local when those are unset.
 */

import { SQL } from 'bun'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const CRMWORTHY_API_URL = 'https://crmworthy.com/api/v1'
const CRMWORTHY_SOURCE_NAME = 'newsworthy.ai'
const DELAY_MS = 1000

function loadEnvFile(path: string) {
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

const scriptDir = import.meta.dir
loadEnvFile(resolve(scriptDir, '../.env.local'))
loadEnvFile(resolve(scriptDir, '../.env'))
loadEnvFile(resolve(scriptDir, '../../../.env.local'))
loadEnvFile(resolve(scriptDir, '../../../.env'))

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity
const sinceIdx = args.indexOf('--since')
const SINCE = sinceIdx !== -1 ? args[sinceIdx + 1] : null
const afterIdx = args.indexOf('--after-id')
const AFTER_ID = afterIdx !== -1 ? parseInt(args[afterIdx + 1], 10) : NaN

const DB_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const API_KEY = (
  process.env.CRMWORTHY_API_KEY ||
  process.env.CRMWROTHY_API_KEY ||
  ''
)
  .trim()
  .replace(/^-+/, '') || undefined

if (!DB_URL) {
  console.error('Missing DIRECT_DATABASE_URL or DATABASE_URL.')
  process.exit(1)
}
if (!API_KEY && !dryRun) {
  console.error('Missing CRMWORTHY_API_KEY (must start with crmw_).')
  process.exit(1)
}
if (API_KEY && !dryRun && !API_KEY.startsWith('crmw_')) {
  console.error(
    `CRMWORTHY_API_KEY looks invalid (expected prefix "crmw_", got "${API_KEY.slice(0, 6)}…").`,
  )
  process.exit(1)
}

console.log(
  dryRun
    ? 'Mode: DRY RUN'
    : `Mode: EXECUTE (API key ${API_KEY?.startsWith('crmw_') ? 'crmw_…' : 'set'})`,
)

const sql = new SQL(DB_URL)

type Row = {
  id: number
  uuid: string
  slug: string
  title: string | null
  status: string
  release_at: Date | string
  user_uuid: string
}

const SELECT_COLS = `
  r.id,
  r.uuid,
  r.slug,
  r.title,
  r.status,
  r.release_at,
  u.uuid AS user_uuid
`

const BASE_WHERE = `
  r.status IN ('approved', 'sent')
  AND (r.is_deleted = false OR r.is_deleted IS NULL)
  AND (u.is_deleted = false OR u.is_deleted IS NULL)
  AND r.release_at IS NOT NULL
  AND r.slug IS NOT NULL AND NULLIF(TRIM(r.slug), '') IS NOT NULL
  AND r.uuid IS NOT NULL AND u.uuid IS NOT NULL
`

function ymd(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function buildReleaseUrl(release: {
  id: number
  slug: string
  releaseAt: Date | string
}): string | null {
  const d = new Date(release.releaseAt)
  if (Number.isNaN(d.getTime()) || !release.slug) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

function buildReportingUrl(releaseUuid: string): string {
  return `https://app.newsworthyai.com/pr/clipsreport/${releaseUuid}`
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function postPressRelease(body: {
  releaseId: number
  releaseUrl: string
  reportingUrl: string
  releaseDate: string
  sourceId: string
  sourceName: string
}) {
  const res = await fetch(`${CRMWORTHY_API_URL}/press-releases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${res.status} ${text.slice(0, 400)}`)
  }
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

async function fetchRows(): Promise<Row[]> {
  if (SINCE && /^\d{4}-\d{2}-\d{2}$/.test(SINCE) && Number.isFinite(AFTER_ID) && AFTER_ID > 0) {
    return await sql`
      SELECT ${sql.unsafe(SELECT_COLS)}
      FROM releases r
      INNER JOIN users u ON u.id = r.user_id
      WHERE ${sql.unsafe(BASE_WHERE)}
        AND r.release_at >= ${SINCE}
        AND r.id > ${AFTER_ID}
      ORDER BY r.id ASC
    `
  }
  if (SINCE && /^\d{4}-\d{2}-\d{2}$/.test(SINCE)) {
    return await sql`
      SELECT ${sql.unsafe(SELECT_COLS)}
      FROM releases r
      INNER JOIN users u ON u.id = r.user_id
      WHERE ${sql.unsafe(BASE_WHERE)}
        AND r.release_at >= ${SINCE}
      ORDER BY r.id ASC
    `
  }
  if (Number.isFinite(AFTER_ID) && AFTER_ID > 0) {
    return await sql`
      SELECT ${sql.unsafe(SELECT_COLS)}
      FROM releases r
      INNER JOIN users u ON u.id = r.user_id
      WHERE ${sql.unsafe(BASE_WHERE)}
        AND r.id > ${AFTER_ID}
      ORDER BY r.id ASC
    `
  }
  return await sql`
    SELECT ${sql.unsafe(SELECT_COLS)}
    FROM releases r
    INNER JOIN users u ON u.id = r.user_id
    WHERE ${sql.unsafe(BASE_WHERE)}
    ORDER BY r.id ASC
  `
}

async function main() {
  console.log(`CRMWorthy press-release backfill${dryRun ? ' (DRY RUN)' : ''}`)
  if (Number.isFinite(LIMIT)) console.log(`Limit: ${LIMIT}`)
  if (SINCE) console.log(`Since: ${SINCE}`)
  if (Number.isFinite(AFTER_ID)) console.log(`After id: ${AFTER_ID}`)
  console.log('Contact identity: sourceName=newsworthy.ai + sourceId=users.uuid')
  console.log('---')

  const rows = await fetchRows()
  const eligible = rows.filter((r) =>
    !!buildReleaseUrl({ id: r.id, slug: r.slug, releaseAt: r.release_at }),
  )
  const toProcess = Number.isFinite(LIMIT) ? eligible.slice(0, LIMIT) : eligible
  console.log(`Eligible: ${eligible.length} · Processing: ${toProcess.length}`)

  let ok = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < toProcess.length; i++) {
    const r = toProcess[i]
    const releaseUrl = buildReleaseUrl({
      id: r.id,
      slug: r.slug,
      releaseAt: r.release_at,
    })
    if (!releaseUrl) {
      skipped++
      continue
    }

    const payload = {
      releaseId: r.id,
      releaseUrl,
      reportingUrl: buildReportingUrl(r.uuid),
      releaseDate: ymd(r.release_at),
      sourceId: r.user_uuid,
      sourceName: CRMWORTHY_SOURCE_NAME,
    }

    const label = `[${i + 1}/${toProcess.length}] #${r.id} ${r.status} ${payload.releaseDate}`

    if (dryRun) {
      console.log(`${label} DRY`, payload)
      ok++
    } else {
      try {
        await postPressRelease(payload)
        ok++
        console.log(`${label} OK ${releaseUrl}`)
      } catch (err) {
        failed++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`${label} FAIL`, msg)
        if (msg.includes('401')) {
          console.error(
            '\nAborting: CRMWorthy 401.\n' +
              `Resume later with: --after-id ${Math.max(0, r.id - 1)}`,
          )
          await sql.close()
          process.exit(1)
        }
      }
    }

    if (i < toProcess.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log('---')
  console.log(`Done. ok=${ok} failed=${failed} skipped=${skipped}`)
  if (toProcess.length > 0) {
    console.log(`Last id processed: ${toProcess[toProcess.length - 1].id}`)
    console.log(`Resume with: --after-id ${toProcess[toProcess.length - 1].id}`)
  }

  await sql.close()
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(err)
  try {
    await sql.close()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
