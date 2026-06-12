/**
 * Backfill SalesNexus contacts from Stripe PAID invoices.
 *
 * Stripe-invoiced customers are largely NOT in our app DB. For each distinct invoiced
 * email this script either creates a fresh contact or updates a matching CRM contact:
 *   - total_spend       = net total over the UNION of the email's invoice charges + (if the
 *                         email is one of our users) their payfile charges, deduped by charge id
 *                         and reconciled against Stripe. Avoids double-counting the overlap.
 *   - Accounts          = 'Stripe Invoiced' (NEW contacts) / appended to existing (MATCHED)
 *   - RegisteredUserSince = date of first paid invoice (NEW only; matched contacts keep theirs)
 *   - a note listing the invoice line items purchased
 *
 * Only PAID invoices are considered.
 *
 * Usage:
 *   bun scripts/backfill-salesnexus-invoices.ts              # dry-run (default), writes preview JSON
 *   bun scripts/backfill-salesnexus-invoices.ts --execute    # write to SalesNexus
 *   bun scripts/backfill-salesnexus-invoices.ts --limit 10   # cap customers (testing)
 *
 * Env: DIRECT_DATABASE_URL, STRIPE_SECRET, SALES_NEXUS_API_KEY
 */

import { SQL } from 'bun'

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
const STRIPE_H = { Authorization: `Bearer ${STRIPE_SECRET}` }
const ACCOUNT_TAG = 'Stripe Invoiced'
const NOTE_PREFIX = 'Stripe invoices'
const STRIPE_CONC = 8
const SNX_CONC = 5
const PREVIEW_PATH = new URL('./salesnexus-invoices-preview.json', import.meta.url).pathname

const sql = new SQL(DB_URL)

// --- helpers ---------------------------------------------------------------
const isoDate = (unixOrStr: number | string | null): string | undefined => {
  if (!unixOrStr) return undefined
  const dt = typeof unixOrStr === 'number' ? new Date(unixOrStr * 1000) : new Date(unixOrStr)
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString().slice(0, 10)
}
const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

async function pool<T>(items: T[], concurrency: number, worker: (item: T, i: number) => Promise<void>) {
  let idx = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) { const cur = idx++; await worker(items[cur], cur) }
  }))
}

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
    } catch (e) { lastErr = e; await Bun.sleep(500 * 2 ** a) }
  }
  throw lastErr
}

// --- 1. Stripe paid invoices ----------------------------------------------
type Invoice = any
async function loadPaidInvoices(): Promise<Invoice[]> {
  const all: Invoice[] = []
  let startingAfter = ''
  for (let page = 0; page < 100; page++) {
    const url = `https://api.stripe.com/v1/invoices?status=paid&limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`
    const res = await fetchRetry(url, { headers: STRIPE_H })
    const d: any = await res.json()
    if (d.error) throw new Error(`Stripe invoices: ${d.error.message}`)
    all.push(...d.data)
    if (!d.has_more) break
    startingAfter = d.data[d.data.length - 1].id
  }
  return all
}

// --- 2. Stripe charge net reconciliation (shared) -------------------------
/** Fetch net cents (amount_captured - amount_refunded, succeeded only) for each charge id.
 *  fallback[id] is used when Stripe can't read the charge (e.g. old account). */
async function netCharges(ids: string[], fallback: Map<string, number>): Promise<Map<string, number>> {
  const net = new Map<string, number>()
  let done = 0
  await pool(ids, STRIPE_CONC, async (id) => {
    try {
      const res = await fetchRetry(`https://api.stripe.com/v1/charges/${id}`, { headers: STRIPE_H })
      const c: any = await res.json()
      if (c && !c.error) {
        net.set(id, c.status === 'succeeded' && c.paid ? (c.amount_captured ?? c.amount ?? 0) - (c.amount_refunded ?? 0) : 0)
      } else {
        net.set(id, fallback.get(id) ?? 0)
      }
    } catch {
      net.set(id, fallback.get(id) ?? 0)
    } finally {
      if (++done % 100 === 0) console.log(`  Stripe: ${done}/${ids.length} charges reconciled`)
    }
  })
  return net
}

// --- record type -----------------------------------------------------------
type LineItem = { description: string; qty: number; amount: number }
type Record = {
  email: string
  name: string
  firstName: string
  lastName: string | undefined
  company: string | undefined
  firstInvoiceDate: string | undefined
  invoiceCount: number
  totalSpendDollars: number
  lineItems: LineItem[]
  note: string
}

function buildNote(invoiceCount: number, totalCents: number, items: LineItem[]): string {
  const lines = items
    .sort((a, b) => b.amount - a.amount)
    .map((li) => `• ${li.qty}× ${li.description} — ${money(li.amount)}`)
  return `${NOTE_PREFIX}: ${invoiceCount} paid, ${money(totalCents)} total.\nLine items purchased:\n${lines.join('\n')}`
}

// --- SalesNexus contact lookup (returns full matched record, max id) -------
async function findContact(email: string): Promise<any | null> {
  const res = await fetchRetry(`${SNX}/contacts?search=${encodeURIComponent(email)}&pageSize=20`, { headers: SNX_H })
  if (!res.ok) throw new Error(`search failed ${res.status} ${(await res.text()).slice(0, 200)}`)
  const data: any = await res.json()
  const matches = (data?.data ?? []).filter((r: any) => (r.email || '').toLowerCase() === email.toLowerCase())
  if (!matches.length) return null
  return matches.reduce((a: any, b: any) => (b.id > a.id ? b : a))
}

async function upsertInvoiceNote(contactId: number, note: string) {
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

function mergeAccounts(existing: string | undefined): string {
  const parts = (existing || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!parts.includes(ACCOUNT_TAG)) parts.push(ACCOUNT_TAG)
  return parts.join(',')
}

/** Ensure 'Stripe Invoiced' is a selectable option on the Accounts dropdown (idempotent). */
async function ensureAccountOption() {
  const res = await fetchRetry(`${SNX}/contact-fields`, { headers: SNX_H })
  const data: any = await res.json()
  const rows: any[] = data?.data ?? data ?? []
  const accounts = rows.find((f) => f.name === 'Accounts')
  if (!accounts) { console.warn('  Accounts field not found — skipping option update'); return }
  const opts: string[] = accounts.options ?? []
  if (opts.includes(ACCOUNT_TAG)) { console.log(`  Accounts already has '${ACCOUNT_TAG}' option`); return }
  const r = await fetchRetry(`${SNX}/contact-fields/Accounts`, {
    method: 'PUT', headers: SNX_H, body: JSON.stringify({ options: [...opts, ACCOUNT_TAG] }),
  })
  console.log(`  Added '${ACCOUNT_TAG}' to Accounts options: ${r.status}`)
}

async function upsert(r: Record): Promise<'created' | 'updated' | 'error'> {
  const matched = await findContact(r.email)
  if (matched) {
    const body: any = {
      email: r.email,
      firstName: matched.firstName || r.firstName,
      customFields: { Accounts: mergeAccounts(matched.customFields?.Accounts), total_spend: r.totalSpendDollars },
    }
    if (matched.lastName) body.lastName = matched.lastName
    const res = await fetchRetry(`${SNX}/contacts/${matched.id}`, { method: 'PUT', headers: SNX_H, body: JSON.stringify(body) })
    if (res.ok) { await upsertInvoiceNote(matched.id, r.note); return 'updated' }
    console.warn(`  ${r.email}: update ${matched.id} failed ${res.status} — creating fresh`)
  }
  const body: any = {
    email: r.email,
    firstName: r.firstName,
    customFields: { Accounts: ACCOUNT_TAG, total_spend: r.totalSpendDollars },
  }
  if (r.lastName) body.lastName = r.lastName
  if (r.company) body.company = r.company
  if (r.firstInvoiceDate) body.customFields.RegisteredUserSince = r.firstInvoiceDate
  const res = await fetchRetry(`${SNX}/contacts`, { method: 'POST', headers: SNX_H, body: JSON.stringify(body) })
  if (!res.ok) { console.error(`  ${r.email}: create failed ${res.status} ${(await res.text()).slice(0, 200)}`); return 'error' }
  const created: any = await res.json()
  await upsertInvoiceNote(created.id, r.note)
  return 'created'
}

// --- main ------------------------------------------------------------------
async function main() {
  console.log(`\n=== SalesNexus invoice backfill — ${EXECUTE ? 'EXECUTE (live writes)' : 'DRY RUN (no writes)'} ===\n`)

  console.log('Loading paid invoices from Stripe…')
  const invoices = await loadPaidInvoices()
  console.log(`  ${invoices.length} paid invoices`)

  // Aggregate per email
  type Agg = { email: string; name: string; invoices: Invoice[]; firstUnix: number; invoiceChargeIds: Set<string>; noChargeCents: number; items: Map<string, LineItem> }
  const byEmail = new Map<string, Agg>()
  for (const inv of invoices) {
    const email = (inv.customer_email || '').toLowerCase()
    if (!email) continue
    let a = byEmail.get(email)
    if (!a) { a = { email, name: '', invoices: [], firstUnix: Infinity, invoiceChargeIds: new Set(), noChargeCents: 0, items: new Map() }; byEmail.set(email, a) }
    a.invoices.push(inv)
    if (inv.customer_name && !a.name) a.name = inv.customer_name
    const when = inv.status_transitions?.paid_at || inv.created
    if (when && when < a.firstUnix) a.firstUnix = when
    if (inv.charge) a.invoiceChargeIds.add(inv.charge)
    else a.noChargeCents += inv.amount_paid || 0
    for (const li of inv.lines?.data ?? []) {
      const key = li.description || '(no description)'
      const cur = a.items.get(key) ?? { description: key, qty: 0, amount: 0 }
      cur.qty += li.quantity || 1
      cur.amount += li.amount || 0
      a.items.set(key, cur)
    }
  }
  let aggs = [...byEmail.values()]
  if (Number.isFinite(LIMIT)) aggs = aggs.slice(0, LIMIT)
  console.log(`  ${aggs.length} distinct invoiced customers`)

  // Map emails -> our users, and those users' payfile charges (for the dedup union)
  const emails = aggs.map((a) => a.email)
  const userRows: { id: number; email: string }[] = await sql.unsafe(`SELECT id, lower(email) AS email FROM users`)
  const userByEmail = new Map(userRows.map((u) => [u.email, u.id]))
  const pfRows: { user_id: number; stripe_charge: string; amount: number }[] = await sql.unsafe(
    `SELECT DISTINCT ON (stripe_charge) stripe_charge, user_id, amount FROM payfile WHERE stripe_charge IS NOT NULL AND amount > 0 AND user_id IS NOT NULL`
  )
  const payfileByUser = new Map<number, { id: string; amount: number }[]>()
  for (const r of pfRows) {
    if (!payfileByUser.has(r.user_id)) payfileByUser.set(r.user_id, [])
    payfileByUser.get(r.user_id)!.push({ id: r.stripe_charge, amount: r.amount })
  }

  // Build the global union charge set + fallback amounts
  const fallback = new Map<string, number>()
  const chargeSetByEmail = new Map<string, Set<string>>()
  for (const a of aggs) {
    const set = new Set<string>(a.invoiceChargeIds)
    for (const inv of a.invoices) if (inv.charge) fallback.set(inv.charge, inv.amount_paid || 0)
    const uid = userByEmail.get(a.email)
    if (uid && payfileByUser.has(uid)) for (const pc of payfileByUser.get(uid)!) { set.add(pc.id); if (!fallback.has(pc.id)) fallback.set(pc.id, pc.amount) }
    chargeSetByEmail.set(a.email, set)
  }
  const allCharges = [...new Set([...chargeSetByEmail.values()].flatMap((s) => [...s]))]
  console.log(`Reconciling ${allCharges.length} union charges against Stripe…`)
  const net = await netCharges(allCharges, fallback)

  // Assemble records
  const records: Record[] = aggs.map((a) => {
    const set = chargeSetByEmail.get(a.email)!
    let cents = a.noChargeCents
    for (const id of set) cents += net.get(id) ?? 0
    const nameParts = a.name.trim().split(/\s+/).filter(Boolean)
    const emailLocal = a.email.split('@')[0]
    const firstName = nameParts[0] || emailLocal || 'Customer'
    const lastName = nameParts.slice(1).join(' ') || undefined
    const items = [...a.items.values()]
    return {
      email: a.email,
      name: a.name,
      firstName,
      lastName,
      company: a.name || undefined,
      firstInvoiceDate: isoDate(a.firstUnix === Infinity ? null : a.firstUnix),
      invoiceCount: a.invoices.length,
      totalSpendDollars: Math.round(cents) / 100,
      lineItems: items,
      note: buildNote(a.invoices.length, cents, items),
    }
  })

  const summary = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    invoicedCustomers: records.length,
    totalSpendDollars: Math.round(records.reduce((s, r) => s + r.totalSpendDollars, 0) * 100) / 100,
    alreadyOurUsers: emails.filter((e) => userByEmail.has(e)).length,
  }
  console.log('\nSummary:', JSON.stringify(summary, null, 2))

  if (!EXECUTE) {
    await Bun.write(PREVIEW_PATH, JSON.stringify({ summary, records }, null, 2))
    console.log(`\nDry run complete. Preview written to:\n  ${PREVIEW_PATH}`)
    await sql.end()
    return
  }

  console.log('\nEnsuring Accounts dropdown option…')
  await ensureAccountOption()

  console.log('Writing to SalesNexus…')
  const counts = { created: 0, updated: 0, error: 0 }
  let processed = 0
  await pool(records, SNX_CONC, async (r) => {
    try { counts[await upsert(r)]++ } catch (e: any) { counts.error++; console.error(`  ${r.email}: ${e?.message || e}`) }
    if (++processed % 20 === 0) console.log(`  ${processed}/${records.length} (created ${counts.created}, updated ${counts.updated}, errors ${counts.error})`)
  })
  console.log('\nDone:', JSON.stringify(counts, null, 2))
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
