import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
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
    const body = await request.json()

    // Convert basePrice from dollars to cents
    let basePriceCents: number | null = null
    if (body.basePrice !== undefined && body.basePrice !== '') {
      basePriceCents = Math.round(parseFloat(body.basePrice) * 100)
      if (isNaN(basePriceCents)) {
        basePriceCents = null
      }
    }

    const updated = await db
      .update(partners)
      .set({
        company: body.company || null,
        brandName: body.brandName || null,
        handle: body.handle || null,
        publisherUrl: body.publisherUrl || null,
        partnerType: body.partnerType || null,
        isActive: body.isActive ?? false,
        contactName: body.contactName || null,
        contactEmail: body.contactEmail || null,
        email: body.email || null,
        phone: body.phone || null,
        addr1: body.addr1 || null,
        addr2: body.addr2 || null,
        csz: body.csz || null,
        basePrice: basePriceCents,
        freePrs: body.freePrs ? parseInt(body.freePrs) : 0,
        feedLength: body.feedLength ? parseInt(body.feedLength) : null,
        backfill: body.backfill || null,
        offerCopy: body.offerCopy || null,
        appkey: body.appkey || null,
        appsecret: body.appsecret || null,
        apptoken: body.apptoken || null,
        includeNewsdb: body.includeNewsdb ?? true,
      })
      .where(and(eq(partners.id, partnerId), eq(partners.isDeleted, false)))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, partner: updated[0] })
  } catch (error) {
    console.error('Error updating partner:', error)
    return NextResponse.json({ error: 'Failed to update partner' }, { status: 500 })
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
    const updated = await db
      .update(partners)
      .set({ isDeleted: true, isActive: false })
      .where(and(eq(partners.id, partnerId), eq(partners.isDeleted, false)))
      .returning()

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting partner:', error)
    return NextResponse.json({ error: 'Failed to delete partner' }, { status: 500 })
  }
}
