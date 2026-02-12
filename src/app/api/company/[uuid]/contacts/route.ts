import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contact, company, releases } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

async function getCompanyForUser(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

// GET: List contacts for a company
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const contacts = await db
    .select()
    .from(contact)
    .where(and(
      eq(contact.companyId, co.id),
      sql`${contact.isDeleted} IS NOT TRUE`
    ))

  return NextResponse.json({ contacts })
}

// POST: Create a contact
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const { uuid } = await params
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const body = await request.json()
  const { name, title, email, phone } = body

  if (!name || name.trim() === '') {
    return NextResponse.json({ error: 'Contact name is required' }, { status: 400 })
  }

  const [newContact] = await db.insert(contact).values({
    uuid: randomUUID(),
    userId,
    companyId: co.id,
    name: name.trim(),
    title: title?.trim() || null,
    email: email?.trim() || null,
    phone: phone?.trim() || null,
  }).returning()

  return NextResponse.json(newContact)
}

// PUT: Update a contact
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const body = await request.json()
  const { contactUuid, name, title, email, phone } = body

  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
  }

  if (!name || name.trim() === '') {
    return NextResponse.json({ error: 'Contact name is required' }, { status: 400 })
  }

  const existing = await db.query.contact.findFirst({
    where: isAdmin
      ? and(eq(contact.uuid, contactUuid), eq(contact.companyId, co.id))
      : and(eq(contact.uuid, contactUuid), eq(contact.userId, userId)),
  })

  if (!existing) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  await db.update(contact)
    .set({
      name: name.trim(),
      title: title?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
    })
    .where(eq(contact.id, existing.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete a contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const body = await request.json()
  const { contactUuid } = body

  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
  }

  const existing = await db.query.contact.findFirst({
    where: isAdmin
      ? and(eq(contact.uuid, contactUuid), eq(contact.companyId, co.id))
      : and(eq(contact.uuid, contactUuid), eq(contact.userId, userId)),
  })

  if (!existing) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Check if contact is assigned to any release
  const assignedRelease = await db.query.releases.findFirst({
    where: and(
      eq(releases.primaryContactId, existing.id),
      sql`${releases.isDeleted} IS NOT TRUE`
    ),
    columns: { id: true },
  })

  if (assignedRelease) {
    return NextResponse.json(
      { error: 'This contact is currently assigned to a press release and cannot be removed. You can edit the contact instead.' },
      { status: 409 }
    )
  }

  await db.update(contact)
    .set({ isDeleted: true })
    .where(eq(contact.id, existing.id))

  return NextResponse.json({ success: true })
}
