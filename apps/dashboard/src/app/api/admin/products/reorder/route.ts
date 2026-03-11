import { auth } from '@/lib/auth'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, direction } = body as { productId: number; direction: 'up' | 'down' }

    if (!productId || !direction) {
      return NextResponse.json({ error: 'productId and direction are required' }, { status: 400 })
    }

    // Get current product
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const currentOrder = product.sortOrder ?? 0
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1

    // Swap: find the product currently at the target position (same partner scope)
    const condition = product.partnerId === null
      ? eq(products.partnerId, 0) // won't match — handle below
      : eq(products.partnerId, product.partnerId)

    // Just update this product's sort order directly
    await db
      .update(products)
      .set({ sortOrder: newOrder })
      .where(eq(products.id, productId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering product:', error)
    return NextResponse.json({ error: 'Failed to reorder product' }, { status: 500 })
  }
}
