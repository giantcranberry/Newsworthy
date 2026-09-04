/**
 * One-off: link Stripe customer to a platform user and backfill paid invoices into payfile.
 *
 * Usage:
 *   doppler run --project newsworthy-dashboard --config dev -- \
 *     bun scripts/import-user-stripe-invoices.ts --user 2309 --customer cus_XXX
 *   ... --dry-run   # list only, no writes
 */

import { SQL } from 'bun'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const userIdx = args.indexOf('--user')
const custIdx = args.indexOf('--customer')
const USER_ID = userIdx !== -1 ? parseInt(args[userIdx + 1], 10) : NaN
const CUSTOMER_ID = custIdx !== -1 ? args[custIdx + 1] : ''

const DB_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
const STRIPE_SECRET = process.env.STRIPE_SECRET

if (!DB_URL || !STRIPE_SECRET) {
  console.error('Missing DIRECT_DATABASE_URL/DATABASE_URL or STRIPE_SECRET')
  process.exit(1)
}
if (!USER_ID || !CUSTOMER_ID?.startsWith('cus_')) {
  console.error('Usage: bun scripts/import-user-stripe-invoices.ts --user <id> --customer cus_xxx [--dry-run]')
  process.exit(1)
}

const sql = new SQL(DB_URL)
const STRIPE_H = { Authorization: `Bearer ${STRIPE_SECRET}` }

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, { headers: STRIPE_H })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status} ${path}`)
  return data
}

async function stripePost(path: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: { ...STRIPE_H, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status} ${path}`)
  return data
}

async function listAllInvoices(customerId: string) {
  const invoices: any[] = []
  let startingAfter: string | undefined
  for (;;) {
    const qs = new URLSearchParams({
      customer: customerId,
      limit: '100',
    })
    // Stripe form encoding for expand arrays
    qs.append('expand[]', 'data.payments')
    if (startingAfter) qs.set('starting_after', startingAfter)
    const page = await stripeGet(`/invoices?${qs}`)
    invoices.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }
  return invoices
}

function paidAmountCents(inv: any): number {
  if ((inv.amount_paid || 0) > 0) return inv.amount_paid
  // Out-of-band / payment_record marked paid — amount_paid can stay 0
  const paidPayment = inv.payments?.data?.find((p: any) => p.status === 'paid' && (p.amount_paid || 0) > 0)
  if (paidPayment?.amount_paid) return paidPayment.amount_paid
  if (inv.status === 'paid' && (inv.total || 0) > 0) return inv.total
  return 0
}

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function invoiceKey(id: string) {
  return id.slice(0, 36)
}

function paymentIntentFromInvoice(inv: any): string | null {
  const paid = inv.payments?.data?.find((p: any) => p.status === 'paid')
  const payment = paid?.payment
  if (payment?.type === 'payment_intent') {
    const pi = payment.payment_intent
    return typeof pi === 'string' ? pi : pi?.id || null
  }
  return null
}

function chargeFromInvoice(inv: any): string | null {
  const paid = inv.payments?.data?.find((p: any) => p.status === 'paid')
  const payment = paid?.payment
  if (payment?.type === 'charge') {
    const ch = payment.charge
    return typeof ch === 'string' ? ch : ch?.id || null
  }
  return null
}

const users = await sql`
  SELECT u.id, u.email, u.partner_id, p.stripe AS profile_stripe
  FROM users u
  LEFT JOIN user_profiles p ON p.user_id = u.id
  WHERE u.id = ${USER_ID}
  LIMIT 1
`
if (!users.length) {
  console.error(`User ${USER_ID} not found`)
  process.exit(1)
}
const user = users[0]
console.log(`User ${user.id} <${user.email}> partner=${user.partner_id ?? 'null'}`)
console.log(`Current profile.stripe: ${user.profile_stripe || '(none)'}`)
console.log(`Target customer: ${CUSTOMER_ID}`)
console.log(dryRun ? 'Mode: DRY RUN' : 'Mode: EXECUTE')

const customer = await stripeGet(`/customers/${CUSTOMER_ID}`)
console.log(`Stripe customer email: ${customer.email || '(none)'} name: ${customer.name || '(none)'}`)

const invoices = await listAllInvoices(CUSTOMER_ID)
const paid = invoices.filter((i) => i.status === 'paid' && paidAmountCents(i) > 0)
const open = invoices.filter((i) => i.status === 'open')
console.log(`Invoices: ${invoices.length} total, ${paid.length} paid, ${open.length} open`)

for (const inv of invoices) {
  console.log(
    `  ${inv.status?.padEnd(12)} ${(inv.number || inv.id).padEnd(18)} ${money(paidAmountCents(inv) || inv.amount_due || 0).padStart(10)}  ${new Date(inv.created * 1000).toISOString().slice(0, 10)}`,
  )
}

if (dryRun) {
  console.log('Dry run complete — no changes written.')
  process.exit(0)
}

// 1. Link stripe customer on profile
const profiles = await sql`SELECT id FROM user_profiles WHERE user_id = ${USER_ID} LIMIT 1`
if (profiles.length) {
  await sql`UPDATE user_profiles SET stripe = ${CUSTOMER_ID} WHERE user_id = ${USER_ID}`
  console.log('Updated user_profiles.stripe')
} else {
  await sql`INSERT INTO user_profiles (user_id, stripe) VALUES (${USER_ID}, ${CUSTOMER_ID})`
  console.log('Created user_profiles with stripe')
}

// 2. Tag Stripe customer metadata
await stripePost(`/customers/${CUSTOMER_ID}`, {
  'metadata[user_id]': String(USER_ID),
  'metadata[imported_from]': 'admin_import_script',
})
console.log('Updated Stripe customer metadata.user_id')

// 3. Backfill payfile for paid invoices (no brand_credits — historical credits unknown)
let inserted = 0
let skipped = 0
for (const inv of paid) {
  const key = invoiceKey(inv.id)
  const existing = await sql`
    SELECT id FROM payfile
    WHERE cart_uuid = ${key}
       OR (user_id = ${USER_ID} AND stripe_charge IS NOT NULL AND stripe_charge = ${chargeFromInvoice(inv) || ''})
    LIMIT 1
  `
  // Also skip if same stripe_intent already recorded for this user
  const pi = paymentIntentFromInvoice(inv)
  if (!existing.length && pi) {
    const byPi = await sql`
      SELECT id FROM payfile WHERE user_id = ${USER_ID} AND stripe_intent = ${pi} LIMIT 1
    `
    if (byPi.length) {
      skipped++
      console.log(`  skip ${inv.number || inv.id} — payfile already has PI ${pi}`)
      continue
    }
  }
  if (existing.length) {
    skipped++
    console.log(`  skip ${inv.number || inv.id} — already in payfile`)
    continue
  }

  const charge = chargeFromInvoice(inv)
  const amount = paidAmountCents(inv)
  const receipt = inv.hosted_invoice_url || inv.invoice_pdf || null
  const createdAt = new Date(inv.created * 1000)
  const partnerId = user.partner_id || 1

  if (amount <= 0) {
    skipped++
    console.log(`  skip ${inv.number || inv.id} — zero amount`)
    continue
  }

  await sql`
    INSERT INTO payfile (
      partner_id, user_id, cart_uuid, receipt_url,
      stripe_customer, stripe_intent, stripe_charge,
      amount, created_at, paid_via
    ) VALUES (
      ${partnerId}, ${USER_ID}, ${key}, ${receipt},
      ${CUSTOMER_ID}, ${pi}, ${charge},
      ${amount}, ${createdAt}, ${'invoice'}
    )
  `
  inserted++
  console.log(`  + payfile ${inv.number || inv.id} ${money(amount)}`)
}

console.log(`Done. payfile inserted=${inserted} skipped=${skipped}`)
process.exit(0)
