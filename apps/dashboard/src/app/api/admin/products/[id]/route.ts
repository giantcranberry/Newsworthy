import { auth } from '@/lib/auth'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    const body = await request.json()
    const {
      displayName,
      shortName,
      description,
      icon,
      price,
      productType,
      isActive,
      isUpgrade,
      isSoloUpgrade,
      label,
      partnerId,
    } = body

    if (!displayName || !price || !productType) {
      return NextResponse.json(
        { error: 'Display name, price, and distribution tag are required' },
        { status: 400 }
      )
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        displayName,
        shortName: shortName || null,
        description: description || null,
        icon: icon || null,
        price,
        productType,
        isActive,
        isUpgrade: isUpgrade ?? true,
        isSoloUpgrade: isSoloUpgrade ?? false,
        label: label || null,
        partnerId: partnerId ?? null,
      })
      .where(eq(products.id, productId))
      .returning()

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(updatedProduct)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
    }

    // Soft delete
    const [deletedProduct] = await db
      .update(products)
      .set({ isDeleted: true })
      .where(eq(products.id, productId))
      .returning()

    if (!deletedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    )
  }
}
