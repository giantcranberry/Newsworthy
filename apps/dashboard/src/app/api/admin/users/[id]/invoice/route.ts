import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, company, companyMembers, payfile } from '@/db/schema'
import { sendInvoiceAdminCopyEmail } from '@/lib/email'
import { eq, sql, or, isNull, ne, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const CREDIT_TYPES = new Set(['pr', 'yahoo', 'enhanced', 'podcast_pr'])

/** Admin invoicing always uses live Stripe (same as /api/admin/sales). */
function getLiveStripe(): Stripe {
  const key = process.env.STRIPE_SECRET
  if (!key) throw new Error('STRIPE_SECRET is not set')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

export type AdminUserInvoice = {
  id: string
  number: string | null
  status: string | null
  amountDue: number
  amountPaid: number
  amountRemaining: number
  currency: string
  created: number
  dueDate: number | null
  hostedInvoiceUrl: string | null
  description: string | null
  credits: number
  creditType: string | null
}

function paidInvoiceCents(inv: Stripe.Invoice): number {
  // Include partial OOB payments on still-open invoices
  if ((inv.amount_paid ?? 0) > 0) return inv.amount_paid!
  if (inv.status === 'paid') return inv.total ?? 0
  return 0
}

function mapInvoice(inv: Stripe.Invoice): AdminUserInvoice {
  const credits = parseInt(inv.metadata?.credits || '0', 10) || 0
  const amountPaid = paidInvoiceCents(inv)
  return {
    id: inv.id,
    number: inv.number,
    status: inv.status,
    amountDue: inv.amount_due ?? 0,
    amountPaid,
    amountRemaining: inv.amount_remaining ?? 0,
    currency: inv.currency || 'usd',
    created: inv.created,
    dueDate: inv.due_date,
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    description: inv.description ?? inv.footer ?? null,
    credits,
    creditType: inv.metadata?.credit_type || null,
  }
}

async function listAllCustomerInvoices(stripe: Stripe, customerId: string) {
  const invoices: Stripe.Invoice[] = []
  let startingAfter: string | undefined
  for (;;) {
    const page = await stripe.invoices.list({
      customer: customerId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    invoices.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    startingAfter = page.data[page.data.length - 1].id
  }
  return invoices
}

/**
 * Lifetime spend = paid Stripe invoices for this customer
 * + non-invoice payfile rows (cart / checkout), so we don't double-count
 * imported invoice payfile rows.
 */
async function updateLifetimeSpend(userId: number, stripeInvoices: Stripe.Invoice[]) {
  const invoiceSpend = stripeInvoices.reduce((sum, inv) => sum + paidInvoiceCents(inv), 0)

  const [otherRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${payfile.amount}), 0)`,
    })
    .from(payfile)
    .where(
      and(
        eq(payfile.userId, userId),
        or(isNull(payfile.paidVia), ne(payfile.paidVia, 'invoice')),
      ),
    )

  const otherSpend = Number(otherRow?.total) || 0
  const lifetimeSpend = invoiceSpend + otherSpend
  const lifetimeSpendUpdatedAt = new Date()

  await db
    .update(userProfiles)
    .set({ lifetimeSpend, lifetimeSpendUpdatedAt })
    .where(eq(userProfiles.userId, userId))

  return { lifetimeSpend, lifetimeSpendUpdatedAt, invoiceSpend, otherSpend }
}

async function requireAdminOrStaff() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff
  if (!isAdmin && !isStaff) return null
  return session
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdminOrStaff())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { profile: true },
  })
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const stripe = getLiveStripe()
    let customerId = user.profile?.stripe || null

    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId)
        if ((customer as Stripe.DeletedCustomer).deleted) customerId = null
      } catch (err) {
        console.error(
          `[Admin Invoice] Could not retrieve customer ${customerId} for user ${userId}:`,
          err,
        )
        customerId = null
      }
    }

    // Fall back to email lookup so Dashboard-created invoices for this email can show up
    if (!customerId && user.email) {
      const matches = await stripe.customers.list({ email: user.email, limit: 5 })
      customerId = matches.data.find((c) => !('deleted' in c && c.deleted))?.id || null
      // Persist so future loads and invoice creates reuse the same customer
      if (customerId && user.profile) {
        await db
          .update(userProfiles)
          .set({ stripe: customerId })
          .where(eq(userProfiles.userId, userId))
      }
    }

    if (!customerId) {
      // Still refresh spend from non-invoice payfile only
      const spend = await updateLifetimeSpend(userId, [])
      return NextResponse.json({
        invoices: [] as AdminUserInvoice[],
        lifetimeSpend: spend.lifetimeSpend,
        lifetimeSpendUpdatedAt: spend.lifetimeSpendUpdatedAt,
      })
    }

    const allInvoices = await listAllCustomerInvoices(stripe, customerId)
    const spend = await updateLifetimeSpend(userId, allInvoices)

    return NextResponse.json({
      invoices: allInvoices.map(mapInvoice),
      customerId,
      lifetimeSpend: spend.lifetimeSpend,
      lifetimeSpendUpdatedAt: spend.lifetimeSpendUpdatedAt,
      invoiceSpend: spend.invoiceSpend,
      otherSpend: spend.otherSpend,
    })
  } catch (err) {
    console.error('[Admin Invoice] Failed to list invoices:', err)
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to list invoices'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function getOrCreateStripeCustomer(
  stripe: Stripe,
  user: { id: number; email: string; partnerId: number | null },
  profile: {
    stripe: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
  } | null,
): Promise<string> {
  let stripeCustomerId = profile?.stripe || null

  if (stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId)
      if ((customer as Stripe.DeletedCustomer).deleted) {
        stripeCustomerId = null
      }
    } catch {
      stripeCustomerId = null
    }
  }

  if (!stripeCustomerId) {
    const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || undefined
    const customer = await stripe.customers.create({
      email: user.email,
      name,
      phone: profile?.phone || undefined,
      metadata: {
        user_id: String(user.id),
        partner_id: String(user.partnerId || ''),
      },
    })
    stripeCustomerId = customer.id

    if (profile) {
      await db
        .update(userProfiles)
        .set({ stripe: stripeCustomerId })
        .where(eq(userProfiles.userId, user.id))
    } else {
      await db.insert(userProfiles).values({
        userId: user.id,
        stripe: stripeCustomerId,
      })
    }
  }

  return stripeCustomerId
}

async function userCanAccessBrand(userId: number, companyId: number): Promise<boolean> {
  const targetBrand = await db.query.company.findFirst({
    where: eq(company.id, companyId),
  })
  if (!targetBrand || targetBrand.isDeleted === true || targetBrand.isArchived === true) {
    return false
  }
  if (targetBrand.userId === userId) return true

  const memberRows = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  return memberRows.some((r) => r.companyId === companyId)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdminOrStaff()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const amountDollars = Number(body.amount)
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const credits = Math.max(0, Math.floor(Number(body.credits) || 0))
  const rawCreditType = typeof body.creditType === 'string' ? body.creditType : 'none'
  const creditType =
    rawCreditType === 'none' || rawCreditType === '' || credits === 0 ? 'none' : rawCreditType
  const grantCredits = creditType !== 'none' && credits > 0
  const companyIdRaw =
    body.companyId === '' || body.companyId == null ? null : Number(body.companyId)
  const daysUntilDue = Math.min(90, Math.max(1, Math.floor(Number(body.daysUntilDue) || 14)))
  const memo = typeof body.memo === 'string' ? body.memo.trim().slice(0, 5000) : ''
  const quantity = Math.max(1, Math.floor(Number(body.quantity) || 1))
  const unitPriceDollars = Number(body.unitPrice)

  // Prefer explicit due date (YYYY-MM-DD); fall back to daysUntilDue
  let dueDateUnix: number | null = null
  if (typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) {
    // Compare calendar dates in US Central (product timezone), not server UTC midnight
    const todayCentral = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    if (body.dueDate < todayCentral) {
      return NextResponse.json({ error: 'Due date must be today or later' }, { status: 400 })
    }
    const [y, m, d] = body.dueDate.split('-').map(Number)
    // Noon UTC on the selected calendar day — Stripe wants unix seconds
    const due = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
    if (!Number.isNaN(due.getTime())) {
      dueDateUnix = Math.floor(due.getTime() / 1000)
    }
  }

  if (!Number.isFinite(amountDollars) || amountDollars <= 0) {
    return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
  }
  if (description.length < 3) {
    return NextResponse.json({ error: 'Description is required (min 3 characters)' }, { status: 400 })
  }
  if (grantCredits && !CREDIT_TYPES.has(creditType)) {
    return NextResponse.json({ error: 'Invalid credit type' }, { status: 400 })
  }
  if (creditType !== 'none' && !grantCredits) {
    return NextResponse.json(
      { error: 'Enter credits to grant, or set credit type to None' },
      { status: 400 },
    )
  }

  const companyId =
    companyIdRaw && Number.isFinite(companyIdRaw) ? companyIdRaw : null

  if (grantCredits && creditType === 'podcast_pr' && !companyId) {
    return NextResponse.json(
      { error: 'Podcast PR credits must be assigned to a brand' },
      { status: 400 },
    )
  }

  if (companyId && !(await userCanAccessBrand(userId, companyId))) {
    return NextResponse.json({ error: 'Brand not found for this user' }, { status: 400 })
  }

  const amountCents = Math.round(amountDollars * 100)
  const useQtyPricing =
    Number.isFinite(unitPriceDollars) && unitPriceDollars > 0 && quantity >= 1
  const unitAmountCents = useQtyPricing
    ? Math.round(unitPriceDollars * 100)
    : amountCents
  const lineQuantity = useQtyPricing ? quantity : 1
  // Prefer qty × unit when provided; otherwise single-line amount
  const lineTotalCents = useQtyPricing ? unitAmountCents * lineQuantity : amountCents
  if (lineTotalCents < 50) {
    return NextResponse.json({ error: 'Amount must be at least $0.50' }, { status: 400 })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { profile: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  try {
    const stripe = getLiveStripe()
    const stripeCustomerId = await getOrCreateStripeCustomer(
      stripe,
      { id: user.id, email: user.email, partnerId: user.partnerId },
      user.profile
        ? {
            stripe: user.profile.stripe,
            firstName: user.profile.firstName,
            lastName: user.profile.lastName,
            phone: user.profile.phone,
          }
        : null,
    )

    const adminId = String((session?.user as any)?.id || '')

    const invoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      collection_method: 'send_invoice',
      ...(dueDateUnix
        ? { due_date: dueDateUnix }
        : { days_until_due: daysUntilDue }),
      pending_invoice_items_behavior: 'exclude',
      metadata: {
        source: 'admin_invoice',
        user_id: String(user.id),
        partner_id: String(user.partnerId || ''),
        credits: String(grantCredits ? credits : 0),
        credit_type: grantCredits ? creditType : '',
        company_id: grantCredits && companyId ? String(companyId) : '',
        created_by_admin: adminId,
        invoice_kind: grantCredits ? 'credits' : 'adhoc',
      },
      // Stripe Dashboard "memo" — the long narrative above line items
      description: memo || undefined,
    })

    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: invoice.id,
      currency: 'usd',
      description,
      ...(useQtyPricing
        ? {
            quantity: lineQuantity,
            unit_amount_decimal: String(unitAmountCents),
          }
        : { amount: lineTotalCents }),
    })

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
    const sent = await stripe.invoices.sendInvoice(finalized.id)

    // Stripe API cannot CC invoice emails — send our own copy to admin
    try {
      await sendInvoiceAdminCopyEmail({
        customerEmail: user.email,
        customerName: [user.profile?.firstName, user.profile?.lastName]
          .filter(Boolean)
          .join(' ') || user.email,
        userId: user.id,
        invoiceNumber: sent.number,
        invoiceId: sent.id,
        amountDue: sent.amount_due ?? lineTotalCents,
        dueDate: sent.due_date,
        description,
        memo: memo || null,
        hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
        invoicePdf: sent.invoice_pdf ?? null,
      })
    } catch (emailErr) {
      console.error('[Admin Invoice] Failed to CC admin on invoice email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      invoiceId: sent.id,
      invoiceNumber: sent.number,
      hostedInvoiceUrl: sent.hosted_invoice_url,
      status: sent.status,
      amountDue: sent.amount_due,
      dueDate: sent.due_date,
    })
  } catch (err) {
    console.error('[Admin Invoice] Failed to create/send invoice:', err)
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to create invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
