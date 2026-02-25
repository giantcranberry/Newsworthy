import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { carts, products, users, paymentLinks } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import type { PaymentLinkProduct } from '@/db/schema/payment'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  // Verify user is an agency
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user?.isAgency) {
    return NextResponse.json({ error: 'Agency account required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cartUuid, companyId } = body as { cartUuid: string; companyId: number | null }

    if (!companyId || companyId <= 0) {
      return NextResponse.json({ error: 'Please select a brand to allocate credits to' }, { status: 400 })
    }

    // Get unpaid cart items
    const cartItems = await db
      .select()
      .from(carts)
      .where(
        and(
          eq(carts.cartUuid, cartUuid),
          eq(carts.userId, userId),
          isNull(carts.paidAt),
        ),
      )

    if (cartItems.length === 0) {
      return NextResponse.json({ error: 'No unpaid cart items found' }, { status: 404 })
    }

    // Build products JSON and calculate total
    const productsJson: PaymentLinkProduct[] = []
    let cartTotal = 0

    for (const item of cartItems) {
      if (!item.productId) continue

      const product = await db.query.products.findFirst({
        where: eq(products.id, item.productId),
      })

      if (product) {
        productsJson.push({
          stripe_price: item.stripePrice || product.stripeLivePrice || product.stripeTestPrice || '',
          product_id: product.id,
          name: product.shortName || product.displayName || 'Product',
          price: product.price,
          credits: product.productCredits || 1,
          product_type: product.productType || 'pr',
        })
        cartTotal += product.price
      }
    }

    if (cartTotal === 0) {
      return NextResponse.json({ error: 'Cart total is zero' }, { status: 400 })
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('base64url')

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Insert payment link
    await db.insert(paymentLinks).values({
      token,
      userId,
      companyId,
      productsJson,
      cartTotal,
      expiresAt,
    })

    return NextResponse.json({ url: `/payment/guest/${token}` })
  } catch (error) {
    console.error('Error generating payment link:', error)
    return NextResponse.json({ error: 'Failed to generate payment link' }, { status: 500 })
  }
}
