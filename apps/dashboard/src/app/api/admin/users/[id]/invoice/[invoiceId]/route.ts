import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, payfile, brandCredits } from '@/db/schema'
import { reportSpendToCrmWorthy } from '@/lib/crmworthy'
import { eq, and, sql, or, isNull, ne } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getLiveStripe(): Stripe {
  const key = process.env.STRIPE_SECRET
  if (!key) throw new Error('STRIPE_SECRET is not set')
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

async function requireAdminOrStaff() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff
  if (!isAdmin && !isStaff) return null
  return session
}

function paidInvoiceCents(inv: Stripe.Invoice): number {
  // Include partial OOB payments on still-open invoices
  if ((inv.amount_paid ?? 0) > 0) return inv.amount_paid!
  if (inv.status === 'paid') return inv.total ?? 0
  return 0
}

const OOB_PAYMENT_METHODS = new Set([
  'check',
  'wire',
  'ach',
  'cash',
  'zelle',
  'venmo',
  'paypal',
  'card_offstripe',
  'other',
])

const OOB_METHOD_LABELS: Record<string, string> = {
  check: 'Check',
  wire: 'Wire transfer',
  ach: 'ACH / bank transfer',
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  paypal: 'PayPal',
  card_offstripe: 'Card (off Stripe)',
  other: 'Other',
}

async function assertInvoiceForUser(userId: number, invoiceId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { profile: true },
  })
  if (!user) return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }

  const stripe = getLiveStripe()
  const invoice = await stripe.invoices.retrieve(invoiceId)
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null

  if (!customerId || !user.profile?.stripe || customerId !== user.profile.stripe) {
    // Also allow match by metadata.user_id for safety
    const metaUser = parseInt(invoice.metadata?.user_id || '', 10)
    if (metaUser !== userId) {
      return {
        error: NextResponse.json(
          { error: 'Invoice does not belong to this user' },
          { status: 403 },
        ),
      }
    }
  }

  return { user, stripe, invoice, customerId }
}

async function refreshLifetimeSpend(userId: number, stripe: Stripe, customerId: string | null) {
  let invoiceSpend = 0
  if (customerId) {
    let startingAfter: string | undefined
    for (;;) {
      const page = await stripe.invoices.list({
        customer: customerId,
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      for (const inv of page.data) invoiceSpend += paidInvoiceCents(inv)
      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }
  }

  const [otherRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${payfile.amount}), 0)` })
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

  return { lifetimeSpend, lifetimeSpendUpdatedAt }
}

async function ensurePayfileForInvoice(
  userId: number,
  partnerId: number | null,
  invoice: Stripe.Invoice,
) {
  const key = invoice.id.slice(0, 36)
  const existing = await db.query.payfile.findFirst({
    where: eq(payfile.cartUuid, key),
  })
  if (existing) return { created: false }

  const amount = paidInvoiceCents(invoice) || invoice.total || invoice.amount_due || 0
  if (amount <= 0) return { created: false }

  await db.insert(payfile).values({
    userId,
    partnerId: partnerId || 1,
    cartUuid: key,
    stripeIntent: null,
    stripeCustomer: typeof invoice.customer === 'string' ? invoice.customer : null,
    stripeCharge: null,
    amount,
    receiptUrl: invoice.hosted_invoice_url || null,
    paidVia: 'invoice',
    createdAt: new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000),
  })

  const credits = Math.max(0, parseInt(invoice.metadata?.credits || '0', 10) || 0)
  const creditType = invoice.metadata?.credit_type || 'pr'
  const companyIdRaw = invoice.metadata?.company_id
    ? parseInt(invoice.metadata.company_id, 10)
    : NaN
  const companyId = Number.isFinite(companyIdRaw) ? companyIdRaw : null

  if (credits > 0 && invoice.metadata?.source === 'admin_invoice') {
    const noteBase = `Invoice: ${invoice.number || invoice.id}`
    await db.insert(brandCredits).values({
      userId,
      companyId,
      credits,
      productType: creditType,
      notes: noteBase.slice(0, 48),
      createdAt: new Date(),
    })
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { uuid: true },
    })
    if (user?.uuid) {
      await reportSpendToCrmWorthy({
        sourceId: user.uuid,
        amountCents: amount,
        nomen:
          invoice.description ||
          (invoice.number ? `Invoice ${invoice.number}` : 'Invoice payment'),
        transactionId: invoice.id,
      })
    }
  } catch (err) {
    console.error('[Admin Invoice] Failed to report spend to CRMWorthy:', err)
  }

  return { created: true }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  if (!(await requireAdminOrStaff())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, invoiceId } = await params
  const userId = parseInt(id)
  if (isNaN(userId) || !invoiceId?.startsWith('in_')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    const result = await assertInvoiceForUser(userId, invoiceId)
    if ('error' in result && result.error) return result.error
    const { stripe, invoice, customerId } = result as Awaited<
      ReturnType<typeof assertInvoiceForUser>
    > & { stripe: Stripe; invoice: Stripe.Invoice; customerId: string | null }

    let status: string = invoice.status || 'unknown'
    if (invoice.status === 'draft') {
      await stripe.invoices.del(invoiceId)
      status = 'deleted'
    } else if (invoice.status === 'open' || invoice.status === 'uncollectible') {
      // Stripe forbids void once any payment has been applied (incl. partial OOB)
      if ((invoice.amount_paid ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              'This invoice has recorded payments and cannot be voided. Issue a credit note for the remaining balance to write it off, or leave it open.',
            code: 'has_payments',
            amountPaid: invoice.amount_paid,
            amountRemaining: invoice.amount_remaining ?? 0,
          },
          { status: 400 },
        )
      }
      const voided = await stripe.invoices.voidInvoice(invoiceId)
      status = voided.status || 'void'
    } else {
      return NextResponse.json(
        { error: `Cannot delete invoice with status "${invoice.status}"` },
        { status: 400 },
      )
    }

    const spend = await refreshLifetimeSpend(userId, stripe, customerId)

    return NextResponse.json({
      success: true,
      invoiceId,
      status,
      lifetimeSpend: spend.lifetimeSpend,
      lifetimeSpendUpdatedAt: spend.lifetimeSpendUpdatedAt,
    })
  } catch (err) {
    console.error('[Admin Invoice] DELETE failed:', err)
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to delete invoice'
    const status =
      err instanceof Stripe.errors.StripeInvalidRequestError ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

/** Record an out-of-band payment (full or partial) with method + amount. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> },
) {
  const session = await requireAdminOrStaff()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, invoiceId } = await params
  const userId = parseInt(id)
  if (isNaN(userId) || !invoiceId?.startsWith('in_')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const action = typeof body?.action === 'string' ? body.action : 'pay_out_of_band'
  if (action !== 'pay_out_of_band') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const paymentMethod =
    typeof body?.paymentMethod === 'string' ? body.paymentMethod.trim().toLowerCase() : ''
  if (!OOB_PAYMENT_METHODS.has(paymentMethod)) {
    return NextResponse.json(
      { error: 'Payment method is required (check, wire, ach, cash, etc.)' },
      { status: 400 },
    )
  }

  const reference =
    typeof body?.reference === 'string' ? body.reference.trim().slice(0, 200) : ''

  try {
    const result = await assertInvoiceForUser(userId, invoiceId)
    if ('error' in result && result.error) return result.error
    const { user, stripe, invoice, customerId } = result as Awaited<
      ReturnType<typeof assertInvoiceForUser>
    > & {
      user: { id: number; partnerId: number | null }
      stripe: Stripe
      invoice: Stripe.Invoice
      customerId: string | null
    }

    if (invoice.status !== 'open') {
      return NextResponse.json(
        { error: `Only open invoices can receive out-of-band payments (status is "${invoice.status}")` },
        { status: 400 },
      )
    }

    const remaining = invoice.amount_remaining ?? invoice.amount_due ?? 0
    if (remaining <= 0) {
      return NextResponse.json({ error: 'Invoice has no remaining balance' }, { status: 400 })
    }

    // Amount in dollars from client; default to full remaining
    let amountCents: number
    if (body?.amount == null || body.amount === '') {
      amountCents = remaining
    } else {
      const dollars = Number(body.amount)
      if (!Number.isFinite(dollars) || dollars <= 0) {
        return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 })
      }
      amountCents = Math.round(dollars * 100)
    }

    if (amountCents > remaining) {
      return NextResponse.json(
        {
          error: `Amount cannot exceed remaining balance ($${(remaining / 100).toFixed(2)})`,
        },
        { status: 400 },
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const methodLabel = OOB_METHOD_LABELS[paymentMethod] || paymentMethod
    const adminId = String((session.user as any)?.id || '')

    const paymentRecord = await stripe.paymentRecords.reportPayment({
      amount_requested: {
        currency: invoice.currency || 'usd',
        value: amountCents,
      },
      initiated_at: now,
      outcome: 'guaranteed',
      guaranteed: { guaranteed_at: now },
      ...(customerId ? { customer_details: { customer: customerId } } : {}),
      payment_method_details: {
        type: 'custom',
        custom: {
          // Stripe allows only one of display_name | type on custom details
          display_name: methodLabel,
        },
      },
      processor_details: {
        type: 'custom',
        custom: {
          payment_reference:
            reference || `${paymentMethod}:${invoice.number || invoice.id}:${now}`,
        },
      },
      description: `${methodLabel} payment for invoice ${invoice.number || invoice.id}`,
      metadata: {
        source: 'admin_oob',
        user_id: String(userId),
        invoice_id: invoiceId,
        payment_method: paymentMethod,
        recorded_by: adminId,
      },
    })

    const paid = await stripe.invoices.attachPayment(invoiceId, {
      payment_record: paymentRecord.id,
    })

    // Keep a short trail on the invoice for Dashboard visibility
    try {
      await stripe.invoices.update(invoiceId, {
        metadata: {
          ...invoice.metadata,
          oob_payment_method: paymentMethod,
          oob_payment_reference: (reference || paymentRecord.id).slice(0, 500),
          oob_last_amount_cents: String(amountCents),
          oob_recorded_by: adminId.slice(0, 100),
        },
      })
    } catch (metaErr) {
      console.error('[Admin Invoice] Failed to update OOB metadata:', metaErr)
    }

    // Credits / payfile only when fully paid
    if (paid.status === 'paid') {
      await ensurePayfileForInvoice(userId, user.partnerId, paid)
    }

    const spend = await refreshLifetimeSpend(userId, stripe, customerId)

    return NextResponse.json({
      success: true,
      invoiceId: paid.id,
      status: paid.status,
      amountPaid: amountCents,
      amountRemaining: paid.amount_remaining ?? 0,
      totalPaid: paid.amount_paid ?? 0,
      paymentMethod,
      lifetimeSpend: spend.lifetimeSpend,
      lifetimeSpendUpdatedAt: spend.lifetimeSpendUpdatedAt,
    })
  } catch (err) {
    console.error('[Admin Invoice] OOB pay failed:', err)
    const message =
      err instanceof Stripe.errors.StripeError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to record payment'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
