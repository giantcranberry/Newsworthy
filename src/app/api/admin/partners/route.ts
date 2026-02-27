import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { company, handle, partnerType, contactEmail } = body

    if (!company?.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const [newPartner] = await db
      .insert(partners)
      .values({
        company: company.trim(),
        handle: handle?.trim() || null,
        partnerType: partnerType || null,
        contactEmail: contactEmail?.trim() || null,
        isActive: false,
        isDeleted: false,
        createdAt: new Date(),
      })
      .returning()

    return NextResponse.json({ success: true, partner: newPartner })
  } catch (error) {
    console.error('Error creating partner:', error)
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
  }
}
