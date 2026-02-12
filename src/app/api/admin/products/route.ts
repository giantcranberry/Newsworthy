import { auth } from '@/lib/auth'
import { db } from '@/db'
import { products } from '@/db/schema'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const isAdmin = (session?.user as any)?.isAdmin

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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

    const [newProduct] = await db
      .insert(products)
      .values({
        displayName,
        shortName: shortName || null,
        description: description || null,
        icon: icon || null,
        price,
        productType,
        isActive: isActive ?? true,
        isUpgrade: isUpgrade ?? true,
        isSoloUpgrade: isSoloUpgrade ?? false,
        label: label || null,
        partnerId: partnerId ?? null,
        partnerShare: 0, // Default value
      })
      .returning()

    return NextResponse.json(newProduct)
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    )
  }
}
