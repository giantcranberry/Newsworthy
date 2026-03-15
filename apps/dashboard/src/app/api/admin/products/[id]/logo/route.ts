import { auth } from '@/lib/auth'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadProductLogo, deleteLogo } from '@/services/s3'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const productId = parseInt(id)

  if (isNaN(productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
  }

  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Delete old logo if exists
    if (product.logoUrl) {
      await deleteLogo(product.logoUrl)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const logoUrl = await uploadProductLogo(buffer, productId, file.type)

    await db
      .update(products)
      .set({ logoUrl })
      .where(eq(products.id, productId))

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    console.error('Error uploading product logo:', error)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const productId = parseInt(id)

  if (isNaN(productId)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
  }

  try {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (product.logoUrl) {
      await deleteLogo(product.logoUrl)
    }

    await db
      .update(products)
      .set({ logoUrl: null })
      .where(eq(products.id, productId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing product logo:', error)
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
  }
}
