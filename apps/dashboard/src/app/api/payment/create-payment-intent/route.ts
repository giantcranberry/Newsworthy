import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { carts, products, userProfiles } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const stripe = await getStripe()
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || 1

  try {
    const body = await request.json()
    const { cartUuid, companyId } = body as { cartUuid: string; companyId: number | null }

    // Get unpaid cart items for this user
    const cartItems = await db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.cartUuid, cartUuid),
          eq(carts.userId, userId),
          isNull(carts.paidAt),
          isNull(carts.paymentIntent),
        ),
      )

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'No unpaid cart items found' }, { status: 404 })
    }

    // Update cart items with companyId if provided
    if (companyId && companyId > 0) {
      for (const item of cartItems) {
        await db
          .update(carts)
          .set({ companyId })
          .where(eq(carts.id, item.id))
      }
    }

    // Calculate total from products
    let totalAmount = 0
    const productNames: string[] = []

    for (const item of cartItems) {
      if (item.productId) {
        const product = await db.query.products.findFirst({
          where: eq(products.id, item.productId),
        })
        if (product) {
          totalAmount += product.price
          productNames.push(product.shortName || product.displayName || 'Product')
        }
      }
    }

    if (totalAmount === 0) {
      return NextResponse.json({ error: 'Cart total is zero' }, { status: 400 })
    }

    // Get or create Stripe customer
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    let stripeCustomerId = profile?.stripe || null

    if (stripeCustomerId) {
      // Verify customer still exists in Stripe
      try {
        await stripe.customers.retrieve(stripeCustomerId)
      } catch {
        stripeCustomerId = null
      }
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        name: session.user.name || undefined,
        metadata: { user_id: userId.toString() },
      })
      stripeCustomerId = customer.id

      // Save to profile
      if (profile) {
        await db
          .update(userProfiles)
          .set({ stripe: stripeCustomerId })
          .where(eq(userProfiles.userId, userId))
      }
    }

    // Create Payment Intent
    const intent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: session.user.email || undefined,
      description: productNames.slice(0, 3).join(', '),
      customer: stripeCustomerId,
      metadata: {
        cart_uuid: cartUuid,
        user_id: userId.toString(),
        partner_id: partnerId.toString(),
      },
    })

    // Store payment intent in cart items
    for (const item of cartItems) {
      await db
        .update(carts)
        .set({ paymentIntent: intent.id })
        .where(eq(carts.id, item.id))
    }

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amount: totalAmount,
    })
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
  }
}
