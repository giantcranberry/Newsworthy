import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { db } from '@/db'
import { cartSessions, cartTransactions, userSubscription, cartItems } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        const userId = parseInt(session.metadata?.userId || '0')
        const cartSessionId = parseInt(session.metadata?.cartSessionId || '0')
        const productId = parseInt(session.metadata?.productId || '0')

        if (cartSessionId) {
          // Update cart session
          await db.update(cartSessions)
            .set({
              status: 'completed',
              completedAt: new Date(),
              stripePaymentIntentId: session.payment_intent as string,
            })
            .where(eq(cartSessions.id, cartSessionId))

          // Record transaction
          await db.insert(cartTransactions).values({
            sessionId: cartSessionId,
            transactionType: 'payment',
            status: 'succeeded',
            amount: session.amount_total || 0,
            currency: session.currency || 'usd',
            stripePaymentIntentId: session.payment_intent as string,
            customerEmail: session.customer_email || undefined,
            processedAt: new Date(),
          })

          // Get cart items to determine credits to add
          const items = await db.query.cartItems.findMany({
            where: eq(cartItems.sessionId, cartSessionId),
          })

          // Add credits to user subscription
          for (const item of items) {
            if (item.productCredits && userId) {
              // Get current subscription
              const sub = await db.query.userSubscription.findFirst({
                where: eq(userSubscription.userId, userId),
              })

              if (sub) {
                const updates: Record<string, number> = {}

                if (item.productType === 'pr' || item.productType === 'credits') {
                  updates.remainingPr = (sub.remainingPr || 0) + item.productCredits
                } else if (item.productType === 'enhanced') {
                  updates.remainingPluspr = (sub.remainingPluspr || 0) + item.productCredits
                } else if (item.productType === 'newsdb') {
                  updates.newsdbCredits = (sub.newsdbCredits || 0) + item.productCredits
                }

                if (Object.keys(updates).length > 0) {
                  await db.update(userSubscription)
                    .set(updates)
                    .where(eq(userSubscription.userId, userId))
                }
              } else {
                // Create subscription record
                const newSub: Record<string, number | null> = {
                  userId,
                  remainingPr: 0,
                  remainingPluspr: 0,
                  newsdbCredits: 0,
                }

                if (item.productType === 'pr' || item.productType === 'credits') {
                  newSub.remainingPr = item.productCredits
                } else if (item.productType === 'enhanced') {
                  newSub.remainingPluspr = item.productCredits
                } else if (item.productType === 'newsdb') {
                  newSub.newsdbCredits = item.productCredits
                }

                await db.insert(userSubscription).values(newSub as any)
              }
            }
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent

        // Find and update cart session
        const cartSession = await db.query.cartSessions.findFirst({
          where: eq(cartSessions.stripePaymentIntentId, paymentIntent.id),
        })

        if (cartSession) {
          await db.insert(cartTransactions).values({
            sessionId: cartSession.id,
            transactionType: 'payment',
            status: 'failed',
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            stripePaymentIntentId: paymentIntent.id,
            errorCode: paymentIntent.last_payment_error?.code || undefined,
            errorMessage: paymentIntent.last_payment_error?.message || undefined,
            processedAt: new Date(),
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
