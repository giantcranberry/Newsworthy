import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/db'
import { carts, products, brandCredits, payfile, paymentLinks, users } from '@/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import type { PaymentLinkProduct } from '@/db/schema/payment'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import type Stripe from 'stripe'
import { createSystemMessage } from '@/lib/messages'
import { getPostHog } from '@/lib/posthog'
import { reportSpendToCrmWorthy } from '@/lib/crmworthy'

async function getUserUuid(userId: number): Promise<string | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { uuid: true },
  })
  return user?.uuid || null
}

export async function POST(request: NextRequest) {
  const stripe = await getStripe()
  const webhookSecret = await getWebhookSecret()
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const paymentIntentId = paymentIntent.id
        const metadata = paymentIntent.metadata || {}
        const cartUuid = metadata.cart_uuid
        const partnerId = parseInt(metadata.partner_id || '1')

        console.log(`[Webhook] payment_intent.succeeded: ${paymentIntentId}`)

        // Check if this is a guest payment link
        if (metadata.payment_link_token) {
          await handleGuestPayment(stripe, paymentIntent, metadata)
          break
        }

        // Atomic claim inside a transaction with row-level locking
        // to prevent double-crediting from concurrent webhook retries.
        const claimed = await db.transaction(async (tx) => {
          // Lock the rows first with FOR UPDATE to prevent concurrent processing
          const locked = await tx.execute(
            sql`SELECT * FROM carts WHERE payment_intent = ${paymentIntentId} AND fulfilled_at IS NULL FOR UPDATE`
          )

          if (locked.length === 0) return []

          // Now update — we hold the lock so no other webhook can claim these
          const updated = await tx
            .update(carts)
            .set({ fulfilledAt: new Date(), paidAt: new Date() })
            .where(
              and(
                eq(carts.paymentIntent, paymentIntentId),
                isNull(carts.fulfilledAt),
              ),
            )
            .returning()

          // Create BrandCredits within the same transaction
          for (const item of updated) {
            if (!item.productId) continue

            const product = await tx.query.products.findFirst({
              where: eq(products.id, item.productId),
            })

            if (product) {
              await tx.insert(brandCredits).values({
                userId: item.userId!,
                companyId: item.companyId || null,
                credits: product.productCredits || 1,
                productType: product.productType || 'pr',
                notes: `Purchase: ${product.shortName || product.displayName}`,
                createdAt: new Date(),
              })
            }
          }

          return updated
        })

        if (claimed.length === 0) {
          console.log('[Webhook] Already fulfilled or no cart items for:', paymentIntentId)
          break
        }

        const userId = claimed[0].userId
        if (!userId) break

        // Create payfile record for receipt tracking (outside transaction — best effort)
        let receiptUrl: string | null = null
        const latestChargeId = paymentIntent.latest_charge
        if (latestChargeId && typeof latestChargeId === 'string') {
          try {
            const charge = await stripe.charges.retrieve(latestChargeId)
            receiptUrl = charge.receipt_url || null
          } catch (err) {
            console.error('[Webhook] Error fetching charge:', err)
          }
        }

        await db.insert(payfile).values({
          userId,
          partnerId,
          cartUuid: cartUuid || claimed[0].cartUuid,
          stripeIntent: paymentIntentId,
          stripeCustomer: typeof paymentIntent.customer === 'string'
            ? paymentIntent.customer
            : null,
          stripeCharge: typeof latestChargeId === 'string' ? latestChargeId : null,
          amount: paymentIntent.amount,
          receiptUrl,
          createdAt: new Date(),
        })

        // Product names for messaging + CRM spend
        const productNames: string[] = []
        for (const item of claimed) {
          if (!item.productId) continue
          const prod = await db.query.products.findFirst({
            where: eq(products.id, item.productId),
            columns: { displayName: true, shortName: true },
          })
          if (prod) productNames.push(prod.displayName || prod.shortName || 'Product')
        }

        // Send system message with receipt info
        try {
          const formattedAmount = `$${(paymentIntent.amount / 100).toFixed(2)}`
          const productList = productNames.length > 0 ? productNames.join(', ') : 'your purchase'
          await createSystemMessage(
            userId,
            'Payment received',
            `Your payment of ${formattedAmount} has been processed. ${productList}.`
          )
        } catch (err) {
          console.error('[Webhook] Failed to create system message for payment:', err)
        }

        getPostHog().capture({
          distinctId: String(userId),
          event: 'payment_completed',
          properties: {
            payment_intent_id: paymentIntentId,
            amount_cents: paymentIntent.amount,
            cart_uuid: cartUuid,
            partner_id: partnerId,
            item_count: claimed.length,
          },
        })

        try {
          const sourceId = await getUserUuid(userId)
          if (sourceId) {
            await reportSpendToCrmWorthy({
              sourceId,
              amountCents: paymentIntent.amount,
              nomen: productNames.length > 0 ? productNames.join(', ') : 'Purchase',
              transactionId: paymentIntentId,
            })
          }
        } catch (err) {
          console.error('[Webhook] Failed to report spend to CRMWorthy:', err)
        }

        console.log(`[Webhook] Fulfilled ${claimed.length} cart items for user ${userId}`)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.error(
          `[Webhook] Payment failed: ${paymentIntent.id}`,
          paymentIntent.last_payment_error?.message,
        )
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleAdminInvoicePaid(stripe, invoice)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

async function handleGuestPayment(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  metadata: Record<string, string>,
) {
  const token = metadata.payment_link_token
  const agencyUserId = parseInt(metadata.user_id)
  const companyId = parseInt(metadata.company_id)

  console.log(`[Webhook] Guest payment for link token: ${token}`)

  // Atomic claim: only fulfill if not yet used
  const [claimedLink] = await db
    .update(paymentLinks)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(paymentLinks.token, token),
        isNull(paymentLinks.usedAt),
      ),
    )
    .returning()

  if (!claimedLink) {
    console.log('[Webhook] Guest payment link already used or not found:', token)
    return
  }

  const products_list = claimedLink.productsJson as PaymentLinkProduct[]

  // Create brand credits for each product — credits go to the agency user
  for (const product of products_list) {
    await db.insert(brandCredits).values({
      userId: agencyUserId,
      companyId,
      credits: product.credits || 1,
      productType: product.product_type || 'pr',
      notes: `Guest purchase: ${product.name}`,
      createdAt: new Date(),
    })
  }

  // Create payfile record
  let receiptUrl: string | null = null
  const latestChargeId = paymentIntent.latest_charge
  if (latestChargeId && typeof latestChargeId === 'string') {
    try {
      const charge = await stripe.charges.retrieve(latestChargeId)
      receiptUrl = charge.receipt_url || null
    } catch (err) {
      console.error('[Webhook] Error fetching charge for guest payment:', err)
    }
  }

  await db.insert(payfile).values({
    userId: agencyUserId,
    partnerId: 1,
    stripeIntent: paymentIntent.id,
    stripeCustomer: typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : null,
    stripeCharge: typeof latestChargeId === 'string' ? latestChargeId : null,
    amount: paymentIntent.amount,
    receiptUrl,
    paidVia: 'guest_link',
    createdAt: new Date(),
  })

  getPostHog().capture({
    distinctId: String(agencyUserId),
    event: 'guest_payment_completed',
    properties: {
      payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      company_id: companyId,
      product_count: products_list.length,
    },
  })

  try {
    const sourceId = await getUserUuid(agencyUserId)
    if (sourceId) {
      const nomen =
        products_list.map((p) => p.name).filter(Boolean).join(', ') || 'Guest purchase'
      await reportSpendToCrmWorthy({
        sourceId,
        amountCents: paymentIntent.amount,
        nomen,
        transactionId: paymentIntent.id,
      })
    }
  } catch (err) {
    console.error('[Webhook] Failed to report guest spend to CRMWorthy:', err)
  }

  console.log(`[Webhook] Guest payment fulfilled for agency user ${agencyUserId}, link ${token}`)
}

async function handleAdminInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice) {
  const metadata = invoice.metadata || {}
  if (metadata.source !== 'admin_invoice') {
    console.log(`[Webhook] Ignoring invoice.paid (not admin_invoice): ${invoice.id}`)
    return
  }

  const userId = parseInt(metadata.user_id || '', 10)
  if (!userId) {
    console.error(`[Webhook] admin invoice.paid missing user_id: ${invoice.id}`)
    return
  }

  console.log(`[Webhook] invoice.paid admin invoice ${invoice.id} for user ${userId}`)

  // Idempotency: cart_uuid stores the Stripe invoice id for admin invoices
  const invoiceKey = invoice.id.slice(0, 36)
  const existing = await db.query.payfile.findFirst({
    where: eq(payfile.cartUuid, invoiceKey),
  })
  if (existing) {
    console.log(`[Webhook] Payfile already exists for invoice ${invoice.id}`)
    return
  }

  const partnerId = parseInt(metadata.partner_id || '1', 10) || 1
  const credits = Math.max(0, parseInt(metadata.credits || '0', 10) || 0)
  const creditType = metadata.credit_type || 'pr'
  const companyIdRaw = metadata.company_id ? parseInt(metadata.company_id, 10) : NaN
  const companyId = Number.isFinite(companyIdRaw) ? companyIdRaw : null

  // Newer Stripe Invoice API removed top-level payment_intent/charge — use payments.
  let paymentIntentId: string | null = null
  let stripeCharge: string | null = null
  let receiptUrl: string | null = invoice.hosted_invoice_url || null

  try {
    const fullInvoice = await stripe.invoices.retrieve(invoice.id, {
      expand: ['payments.data.payment.payment_intent'],
    })
    const paidPayment = fullInvoice.payments?.data?.find((p) => p.status === 'paid')
    const payment = paidPayment?.payment
    if (payment?.type === 'payment_intent') {
      const pi = payment.payment_intent
      paymentIntentId = typeof pi === 'string' ? pi : pi?.id || null
      if (pi && typeof pi !== 'string' && typeof pi.latest_charge === 'string') {
        stripeCharge = pi.latest_charge
      }
    } else if (payment?.type === 'charge') {
      stripeCharge = typeof payment.charge === 'string' ? payment.charge : payment.charge?.id || null
    }
  } catch (err) {
    console.error('[Webhook] Error expanding invoice payments:', err)
  }

  if (!receiptUrl && paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      const latestChargeId = pi.latest_charge
      if (typeof latestChargeId === 'string') {
        stripeCharge = stripeCharge || latestChargeId
        const charge = await stripe.charges.retrieve(latestChargeId)
        receiptUrl = charge.receipt_url || receiptUrl
      }
    } catch (err) {
      console.error('[Webhook] Error fetching charge for admin invoice:', err)
    }
  } else if (!receiptUrl && stripeCharge) {
    try {
      const charge = await stripe.charges.retrieve(stripeCharge)
      receiptUrl = charge.receipt_url || receiptUrl
    } catch (err) {
      console.error('[Webhook] Error fetching charge receipt for admin invoice:', err)
    }
  }

  await db.transaction(async (tx) => {
    await tx.insert(payfile).values({
      userId,
      partnerId,
      cartUuid: invoiceKey,
      stripeIntent: paymentIntentId,
      stripeCustomer: typeof invoice.customer === 'string' ? invoice.customer : null,
      stripeCharge,
      amount: invoice.amount_paid || invoice.amount_due || 0,
      receiptUrl,
      paidVia: 'invoice',
      createdAt: new Date(),
    })

    if (credits > 0) {
      const noteBase = `Invoice: ${invoice.number || invoice.id}`
      await tx.insert(brandCredits).values({
        userId,
        companyId,
        credits,
        productType: creditType,
        notes: noteBase.slice(0, 48),
        createdAt: new Date(),
      })
    }
  })

  try {
    const formattedAmount = `$${((invoice.amount_paid || 0) / 100).toFixed(2)}`
    await createSystemMessage(
      userId,
      'Invoice paid',
      `Your invoice${invoice.number ? ` ${invoice.number}` : ''} payment of ${formattedAmount} has been received.${
        credits > 0 ? ` ${credits} ${creditType} credit${credits === 1 ? '' : 's'} added.` : ''
      }`,
    )
  } catch (err) {
    console.error('[Webhook] Failed to create system message for invoice:', err)
  }

  getPostHog().capture({
    distinctId: String(userId),
    event: 'admin_invoice_paid',
    properties: {
      invoice_id: invoice.id,
      invoice_number: invoice.number,
      amount_cents: invoice.amount_paid,
      credits,
      credit_type: creditType,
      company_id: companyId,
    },
  })

  try {
    const sourceId = await getUserUuid(userId)
    const amountCents = invoice.amount_paid || invoice.amount_due || 0
    if (sourceId && amountCents > 0) {
      await reportSpendToCrmWorthy({
        sourceId,
        amountCents,
        nomen:
          invoice.description ||
          (invoice.number ? `Invoice ${invoice.number}` : 'Invoice payment'),
        transactionId: invoice.id,
      })
    }
  } catch (err) {
    console.error('[Webhook] Failed to report invoice spend to CRMWorthy:', err)
  }

  console.log(
    `[Webhook] Admin invoice ${invoice.id} recorded for user ${userId}` +
      (credits > 0 ? ` (+${credits} ${creditType} credits)` : ''),
  )
}
