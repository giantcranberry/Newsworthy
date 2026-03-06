import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadPartnerLogo, deleteLogo } from '@/services/s3'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const partnerId = parseInt(id)

  if (isNaN(partnerId)) {
    return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 })
  }

  try {
    const partner = await db.query.partners.findFirst({
      where: and(eq(partners.id, partnerId), eq(partners.isDeleted, false)),
    })

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
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
    if (partner.logo) {
      await deleteLogo(partner.logo)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const logoUrl = await uploadPartnerLogo(buffer, partnerId, file.type)

    await db
      .update(partners)
      .set({ logo: logoUrl })
      .where(eq(partners.id, partnerId))

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    console.error('Error uploading partner logo:', error)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const partnerId = parseInt(id)

  if (isNaN(partnerId)) {
    return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 })
  }

  try {
    const partner = await db.query.partners.findFirst({
      where: and(eq(partners.id, partnerId), eq(partners.isDeleted, false)),
    })

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    if (partner.logo) {
      await deleteLogo(partner.logo)
    }

    await db
      .update(partners)
      .set({ logo: null })
      .where(eq(partners.id, partnerId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing partner logo:', error)
    return NextResponse.json({ error: 'Failed to remove logo' }, { status: 500 })
  }
}
