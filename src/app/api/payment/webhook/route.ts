import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/db'
import { carts, products, brandCredits, payfile } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import type Stripe from 'stripe'

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
