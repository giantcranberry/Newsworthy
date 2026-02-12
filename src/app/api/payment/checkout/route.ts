import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { cartSessions, cartItems, products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import Stripe from 'stripe'
import { v4 as uuidv4 } from 'uuid'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover',
})

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || 1

  try {
    const body = await request.json()
    const { productId } = body

    // Get the product
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Create or get cart session
    const sessionUuid = uuidv4()
    const [cartSession] = await db.insert(cartSessions).values({
      sessionUuid,
      userId,
      partnerId,
      status: 'draft',
      subtotal: product.price || 0,
      taxAmount: 0,
      totalAmount: product.price || 0,
    }).returning()

    // Add item to cart
    await db.insert(cartItems).values({
      sessionId: cartSession.id,
      productId: product.id,
      productName: product.displayName || product.shortName || 'Product',
      productType: product.productType || 'credits',
      productCredits: product.productCredits,
      unitPrice: product.price || 0,
      quantity: 1,
      totalPrice: product.price || 0,
      stripePriceId: product.stripeLive || product.stripeTest,
    })

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: product.displayName || product.shortName || 'Product',
              description: product.description || undefined,
            },
            unit_amount: product.price || 0,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/paygo`,
      customer_email: session.user.email || undefined,
      metadata: {
        userId: userId.toString(),
        cartSessionId: cartSession.id.toString(),
        productId: productId.toString(),
      },
    })

    // Update cart session with Stripe info
    await db.update(cartSessions)
      .set({
        stripePaymentIntentId: checkoutSession.payment_intent as string,
        paymentAttemptedAt: new Date(),
      })
      .where(eq(cartSessions.id, cartSession.id))

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
