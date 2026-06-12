/**
 * One-time backfill: create/update a SalesNexus contact for every non-deleted,
 * non-internal user, populated with registration date, lifetime spend (reconciled
 * against Stripe), Newsworthy.ai press-release activity, and a note listing the
 * brands (companies) configured in their account.
 *
 * Usage:
 *   bun scripts/backfill-salesnexus.ts                 # dry-run (default): reads DB + Stripe, writes preview JSON, NO SalesNexus writes
 *   bun scripts/backfill-salesnexus.ts --execute       # perform the upserts into SalesNexus
 *   bun scripts/backfill-salesnexus.ts --limit 25      # only process the first N users (testing)
 *   bun scripts/backfill-salesnexus.ts --execute --limit 25
 *
 * Env required: DIRECT_DATABASE_URL, STRIPE_SECRET, SALES_NEXUS_API_KEY
 */

import { SQL } from 'bun'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const EXECUTE = process.argv.includes('--execute')
const limitArg = process.argv.indexOf('--limit')
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity

const DB_URL = process.env.DIRECT_DATABASE_URL
const STRIPE_SECRET = process.env.STRIPE_SECRET
const SNX_KEY = process.env.SALES_NEXUS_API_KEY
if (!DB_URL || !STRIPE_SECRET || !SNX_KEY) {
  console.error('Missing required env: DIRECT_DATABASE_URL, STRIPE_SECRET, SALES_NEXUS_API_KEY')
  process.exit(1)
}

const SNX = 'https://api.salesnex.us/api/v1'
const SNX_H = { 'X-Api-Key': SNX_KEY, 'Content-Type': 'application/json', Accept: 'application/json' }
const ACCOUNT = 'Newsworthy.ai'
const HOUSE_PARTNER_ID = 1 // default "house" partner — not treated as a referring partner
const STRIPE_CONC = 8
const SNX_CONC = 5
const NOTE_PREFIX = 'Brands configured'
const PREVIEW_PATH = new URL('./salesnexus-backfill-preview.json', import.meta.url).pathname

const sql = new SQL(DB_URL)

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const isoDate = (d: Date | string | null): string | undefined => {
  if (!d) return undefined
  const dt = typeof d === 'string' ? new Date(d) : d
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10)
}

/** Run an array of async thunks with bounded concurrency. */
async function pool<T>(items: T[], concurrency: number, worker: (item: T, i: number) => Promise<void>) {
  let idx = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++
      await worker(items[cur], cur)
    }
  })
  await Promise.all(runners)
}

/** fetch with retry/backoff on 429 + 5xx. Returns the final Response (even if 5xx) so the
 *  caller can read the error body; throws only on repeated network failure. */
async function fetchRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  let lastErr: any
  for (let a = 0; a < attempts; a++) {
    try {
      const res = await fetch(url, init)
      if ((res.status === 429 || res.status >= 500) && a < attempts - 1) {
        const ra = Number(res.headers.get('retry-after'))
        await Bun.sleep((ra ? ra * 1000 : 0) || 500 * 2 ** a)
        continue
      }
      return res
    } catch (e) {
      lastErr = e
      await Bun.sleep(500 * 2 ** a)
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// 1. Load source data from the DB
// ---------------------------------------------------------------------------
type UserRow = {
  id: number
  email: string
  first_name: string | null
  last_name: string | null
  created_at: string | null
  partner_id: number | null
}

async function loadUsers(): Promise<UserRow[]> {
  return await sql.unsafe(`
    SELECT u.id, u.email, p.first_name, p.last_name, u.created_at, u.partner_id
    FROM users u
    LEFT JOIN user_profiles p ON p.user_id = u.id
    WHERE u.is_deleted = false
      AND NOT (u.is_admin OR u.is_staff OR u.is_super OR u.is_editor OR u.is_accounting OR u.is_manager)
    ORDER BY u.id
  `)
}

async function loadPartners(): Promise<Map<number, string>> {
  const rows: { id: number; company: string | null; brand_name: string | null; handle: string | null }[] =
    await sql.unsafe(`SELECT id, company, brand_name, handle FROM partners`)
  const m = new Map<number, string>()
  for (const r of rows) {
    const name = (r.company || r.brand_name || r.handle || '').trim()
    if (name) m.set(r.id, name)
  }
  return m
}

async function loadReleases(): Promise<Map<number, { last: string | null; count: number }>> {
  const rows: { user_id: number; last: string | null; count: number }[] = await sql.unsafe(`
    SELECT user_id, MAX(released_at) AS last, COUNT(*)::int AS count
    FROM releases WHERE status = 'sent' GROUP BY user_id
  `)
  const m = new Map<number, { last: string | null; count: number }>()
  for (const r of rows) m.set(r.user_id, { last: r.last, count: r.count })
  return m
}

async function loadBrands(): Promise<Map<number, string[]>> {
  const rows: { user_id: number; brands: string[] }[] = await sql.unsafe(`
    SELECT user_id, array_agg(company_name ORDER BY company_name) AS brands
    FROM company WHERE is_deleted = false AND is_archived = false
    GROUP BY user_id
  `)
  const m = new Map<number, string[]>()
  for (const r of rows) m.set(r.user_id, r.brands)
  return m
}

/** Count of brand profiles per user where is_deleted = false (archived included). */
async function loadBrandCounts(): Promise<Map<number, number>> {
  const rows: { user_id: number; count: number }[] = await sql.unsafe(`
    SELECT user_id, COUNT(*)::int AS count
    FROM company WHERE is_deleted = false
    GROUP BY user_id
  `)
  const m = new Map<number, number>()
  for (const r of rows) m.set(r.user_id, r.count)
  return m
}

// ---------------------------------------------------------------------------
// 2. Spend — reconciled against Stripe
//    Universe = distinct ch_ charges recorded in payfile (amount > 0).
//    Net per charge = amount_captured - amount_refunded, only when succeeded.
// ---------------------------------------------------------------------------
async function loadSpendCents(): Promise<Map<number, number>> {
  const rows: { user_id: number; stripe_charge: string; amount: number }[] = await sql.unsafe(`
    SELECT DISTINCT ON (stripe_charge) stripe_charge, user_id, amount
    FROM payfile
    WHERE stripe_charge IS NOT NULL AND amount > 0 AND user_id IS NOT NULL
  `)
  const spend = new Map<number, number>()
  const add = (userId: number, cents: number) => { if (cents > 0) spend.set(userId, (spend.get(userId) ?? 0) + cents) }
  let done = 0
  let fallback = 0 // charges Stripe couldn't read (e.g. old account) — use local payfile amount
  await pool(rows, STRIPE_CONC, async (row) => {
    try {
      const res = await fetchRetry(`https://api.stripe.com/v1/charges/${row.stripe_charge}`, {
        headers: { Authorization: `Bearer ${STRIPE_SECRET}` },
      })
      const c: any = await res.json()
      if (c && !c.error) {
        if (c.status === 'succeeded' && c.paid) {
          add(row.user_id, (c.amount_captured ?? c.amount ?? 0) - (c.amount_refunded ?? 0))
        }
      } else {
        fallback++; add(row.user_id, row.amount) // not in this Stripe account — trust the recorded amount
      }
    } catch {
      fallback++; add(row.user_id, row.amount)
    } finally {
      if (++done % 100 === 0) console.log(`  Stripe: ${done}/${rows.length} charges reconciled`)
    }
  })
  console.log(`  Stripe: ${rows.length} charges reconciled (${fallback} fell back to local amount), ${spend.size} users with spend`)
  return spend
}

// ---------------------------------------------------------------------------
// Build the per-user SalesNexus payloads
// ---------------------------------------------------------------------------
type Record = {
  userId: number
  email: string
  firstName: string
  lastName: string | undefined
  customFields: globalThis.Record<string, string | number>
  spendDollars: number
  brands: string[]
  note: string | undefined
}

function buildRecord(
  u: UserRow,
  partners: Map<number, string>,
  releases: Map<number, { last: string | null; count: number }>,
  brandsMap: Map<number, string[]>,
  brandCounts: Map<number, number>,
  spendCents: Map<number, number>,
): Record {
  const emailLocal = u.email.split('@')[0]
  const firstName = (u.first_name || '').trim() || emailLocal || 'Newsworthy'
  const lastName = (u.last_name || '').trim() || undefined

  const cf: globalThis.Record<string, string | number> = { Accounts: ACCOUNT }
  const reg = isoDate(u.created_at)
  if (reg) cf.RegisteredUserSince = reg

  if (u.partner_id && u.partner_id !== HOUSE_PARTNER_ID) {
    const pName = partners.get(u.partner_id)
    if (pName) cf.partner = pName
  }

  const cents = spendCents.get(u.id) ?? 0
  const spendDollars = Math.round(cents) / 100
  if (cents > 0) cf.total_spend = spendDollars

  const rel = releases.get(u.id)
  if (rel) {
    const last = isoDate(rel.last)
    if (last) cf.last_nw_release = last
    if (rel.count > 0) cf.release_count_nw = rel.count
  }

  const brandCount = brandCounts.get(u.id) ?? 0
  if (brandCount > 0) cf.brand_count = brandCount

  const brands = (brandsMap.get(u.id) ?? []).map((b) => b.trim()).filter(Boolean)
  const note = brands.length ? `${NOTE_PREFIX} (${brands.length}): ${brands.join(', ')}` : undefined

  return { userId: u.id, email: u.email, firstName, lastName, customFields: cf, spendDollars, brands, note }
}

// ---------------------------------------------------------------------------
// SalesNexus upsert
// ---------------------------------------------------------------------------
async function findContactIdByEmail(email: string): Promise<number | null> {
  const res = await fetchRetry(`${SNX}/contacts?search=${encodeURIComponent(email)}&pageSize=20`, { headers: SNX_H })
  if (!res.ok) throw new Error(`search failed ${res.status} ${(await res.text()).slice(0, 200)}`)
  const data: any = await res.json()
  const rows: any[] = data?.data ?? []
  const matches = rows.filter((r) => (r.email || '').toLowerCase() === email.toLowerCase())
  if (!matches.length) return null
  // Search also returns soft-deleted contacts (indistinguishable here). The live record is
  // always the most recently created, so prefer the highest id — keeps re-runs idempotent.
  return matches.reduce((a, b) => (b.id > a.id ? b : a)).id
}

async function upsertBrandNote(contactId: number, note: string) {
  const res = await fetchRetry(`${SNX}/notes?contactId=${contactId}&pageSize=50`, { headers: SNX_H })
  const data: any = res.ok ? await res.json() : []
  const rows: any[] = Array.isArray(data) ? data : data?.data ?? []
  const existing = rows.find((n) => (n.noteText || '').startsWith(NOTE_PREFIX))
  if (existing) {
    await fetchRetry(`${SNX}/notes/${existing.id}`, { method: 'PUT', headers: SNX_H, body: JSON.stringify({ noteText: note }) })
  } else {
    await fetchRetry(`${SNX}/notes`, { method: 'POST', headers: SNX_H, body: JSON.stringify({ contactId, noteText: note }) })
  }
}

async function upsertContact(r: Record): Promise<'created' | 'updated' | 'error'> {
  const body: any = { email: r.email, firstName: r.firstName, customFields: r.customFields }
  if (r.lastName) body.lastName = r.lastName

  const existingId = await findContactIdByEmail(r.email)

  if (existingId) {
    const res = await fetchRetry(`${SNX}/contacts/${existingId}`, { method: 'PUT', headers: SNX_H, body: JSON.stringify(body) })
    if (res.ok) {
      if (r.note) await upsertBrandNote(existingId, r.note)
      return 'updated'
    }
    // PUT 500s on soft-deleted contacts (search returns them but they can't be updated).
    // Fall through and create a fresh live contact instead.
    console.warn(`  user ${r.userId} (${r.email}): update ${existingId} failed ${res.status} — creating fresh`)
  }

  const res = await fetchRetry(`${SNX}/contacts`, { method: 'POST', headers: SNX_H, body: JSON.stringify(body) })
  if (!res.ok) { console.error(`  user ${r.userId} (${r.email}): create failed ${res.status} ${await res.text()}`); return 'error' }
  const created: any = await res.json()
  if (r.note) await upsertBrandNote(created.id, r.note)
  return 'created'
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== SalesNexus backfill — ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY RUN (no writes)'} ===\n`)

  console.log('Loading users…')
  let users = await loadUsers()
  if (Number.isFinite(LIMIT)) users = users.slice(0, LIMIT)
  console.log(`  ${users.length} users in scope`)

  console.log('Loading partners / releases / brands…')
  const [partners, releases, brandsMap, brandCounts] = await Promise.all([
    loadPartners(), loadReleases(), loadBrands(), loadBrandCounts(),
  ])

  console.log('Reconciling spend against Stripe…')
  const spendCents = await loadSpendCents()

  const records = users.map((u) => buildRecord(u, partners, releases, brandsMap, brandCounts, spendCents))

  // Summary
  const summary = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    usersInScope: records.length,
    withSpend: records.filter((r) => r.customFields.total_spend !== undefined).length,
    totalSpendDollars: Math.round(records.reduce((s, r) => s + r.spendDollars, 0) * 100) / 100,
    withReleases: records.filter((r) => r.customFields.release_count_nw !== undefined).length,
    withBrandCount: records.filter((r) => r.customFields.brand_count !== undefined).length,
    withBrandNote: records.filter((r) => r.note).length,
    withPartner: records.filter((r) => r.customFields.partner !== undefined).length,
  }
  console.log('\nSummary:', JSON.stringify(summary, null, 2))

  if (!EXECUTE) {
    await Bun.write(PREVIEW_PATH, JSON.stringify({ summary, records }, null, 2))
    console.log(`\nDry run complete. Preview written to:\n  ${PREVIEW_PATH}`)
    console.log('Inspect it, then re-run with --execute to write to SalesNexus.')
    await sql.end()
    return
  }

  console.log('\nWriting to SalesNexus…')
  const counts = { created: 0, updated: 0, error: 0 }
  let processed = 0
  await pool(records, SNX_CONC, async (r) => {
    try {
      const result = await upsertContact(r)
      counts[result]++
    } catch (e: any) {
      counts.error++
      console.error(`  user ${r.userId} (${r.email}): ${e?.message || e}`)
    }
    if (++processed % 50 === 0) console.log(`  ${processed}/${records.length} (created ${counts.created}, updated ${counts.updated}, errors ${counts.error})`)
  })
  console.log('\nDone:', JSON.stringify(counts, null, 2))
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
