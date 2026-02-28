import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/db'
import { carts, products, brandCredits, payfile, paymentLinks } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { PaymentLinkProduct } from '@/db/schema/payment'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import type Stripe from 'stripe'
import { createSystemMessage } from '@/lib/messages'

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

        // Atomic claim: only fulfill items not yet fulfilled.
        // UPDATE ... WHERE fulfilledAt IS NULL prevents double-crediting
        // if Stripe delivers the webhook more than once.
        const claimed = await db
          .update(carts)
          .set({ fulfilledAt: new Date(), paidAt: new Date() })
          .where(
            and(
              eq(carts.paymentIntent, paymentIntentId),
              isNull(carts.fulfilledAt),
            ),
          )
          .returning()

        if (claimed.length === 0) {
          console.log('[Webhook] Already fulfilled or no cart items for:', paymentIntentId)
          break
        }

        const userId = claimed[0].userId
        if (!userId) break

        // Create BrandCredits for each claimed item
        for (const item of claimed) {
          if (!item.productId) continue

          const product = await db.query.products.findFirst({
            where: eq(products.id, item.productId),
          })

          if (product) {
            await db.insert(brandCredits).values({
              userId,
              companyId: item.companyId || null,
              credits: product.productCredits || 1,
              productType: product.productType || 'pr',
              notes: `Purchase: ${product.shortName || product.displayName}`,
              createdAt: new Date(),
            })
          }
        }

        // Create payfile record for receipt tracking
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

        // Send system message with receipt info
        try {
          const productNames: string[] = []
          for (const item of claimed) {
            if (!item.productId) continue
            const prod = await db.query.products.findFirst({
              where: eq(products.id, item.productId),
              columns: { displayName: true, shortName: true },
            })
            if (prod) productNames.push(prod.displayName || prod.shortName || 'Product')
          }
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

  console.log(`[Webhook] Guest payment fulfilled for agency user ${agencyUserId}, link ${token}`)
}
