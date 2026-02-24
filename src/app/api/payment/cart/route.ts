import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { carts, products } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || 1

  try {
    const body = await request.json()
    const { productIds } = body as { productIds: number[] }

    if (!productIds || productIds.length === 0) {
      return NextResponse.json({ error: 'No products selected' }, { status: 400 })
    }

    // Get selected products
    const selectedProducts = await db
      .select()
      .from(products)
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.isActive, true),
          eq(products.isDeleted, false),
        ),
      )

    if (selectedProducts.length === 0) {
      return NextResponse.json({ error: 'No valid products found' }, { status: 404 })
    }

    const cartUuid = uuidv4().replace(/-/g, '')

    // Create a cart entry for each product (matching Flask pattern)
    for (const product of selectedProducts) {
      await db.insert(carts).values({
        cartUuid,
        userId,
        partnerId: product.partnerId || partnerId,
        productId: product.id,
        productCredits: product.productCredits,
        productType: product.productType,
        stripePrice: product.stripeLivePrice || product.stripeTestPrice,
        isPr: product.isPrimary,
        createdAt: new Date(),
      })
    }

    return NextResponse.json({ cartUuid })
  } catch (error) {
    console.error('Error creating cart:', error)
    return NextResponse.json({ error: 'Failed to create cart' }, { status: 500 })
  }
}
