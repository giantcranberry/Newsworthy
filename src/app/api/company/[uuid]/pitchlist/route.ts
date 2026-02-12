import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, pitchGroups, pitchList } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

function getMd5(email: string) {
  return createHash('md5').update(email.toLowerCase()).digest('hex')
}

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

async function getOrCreateGroup(companyId: number, userId: number, companyName: string) {
  let group = await db.query.pitchGroups.findFirst({
    where: eq(pitchGroups.coId, companyId),
  })

  if (!group) {
    const [newGroup] = await db.insert(pitchGroups).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      coId: companyId,
      groupName: companyName,
    }).returning()
    group = newGroup
  }

  return group
}

// GET: Fetch pitch group + paginated contacts + stats
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

  const group = await getOrCreateGroup(co.id, userId, co.companyName)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = 40

  const notDeleted = and(
    eq(pitchList.groupId, group.id),
    sql`${pitchList.isDeleted} IS NOT TRUE`
  )

  const contacts = await db
    .select()
    .from(pitchList)
    .where(notDeleted)
    .orderBy(desc(pitchList.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(notDeleted)

  const [bouncedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(and(notDeleted, isNotNull(pitchList.bouncedAt)))

  const [unsubRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(and(notDeleted, isNotNull(pitchList.unsubscribeAt)))

  const total = Number(countRow?.count || 0)
  const bounced = Number(bouncedRow?.count || 0)
  const unsubscribed = Number(unsubRow?.count || 0)
  const active = total - bounced - unsubscribed

  return NextResponse.json({
    group: {
      id: group.id,
      uuid: group.uuid,
      groupName: group.groupName,
    },
    contacts,
    stats: { total, active, bounced, unsubscribed },
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  })
}

// POST: Add contacts (bulk or single)
export async function POST(
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

  const group = await getOrCreateGroup(co.id, userId, co.companyName)
  const body = await request.json()

  // Single contact add
  if (body.mode === 'single') {
    const { firstName, lastName, email, tld, publication, phone, notes } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }
    if (!tld?.trim()) {
      return NextResponse.json({ error: 'Publication domain is required' }, { status: 400 })
    }

    const emailMd5 = getMd5(email.trim())

    // Check for duplicate
    const existing = await db.query.pitchList.findFirst({
      where: and(
        eq(pitchList.md5, emailMd5),
        eq(pitchList.groupId, group.id)
      ),
    })

    if (existing) {
      return NextResponse.json({ error: 'A contact with this email already exists in your pitch list' }, { status: 409 })
    }

    const [newContact] = await db.insert(pitchList).values({
      groupId: group.id,
      companyId: co.id,
      userId,
      uuid: randomUUID().replace(/-/g, ''),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      md5: emailMd5,
      tld: tld.trim().toLowerCase(),
      publication: publication?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      source: 'single',
    }).returning()

    return NextResponse.json({ success: true, contact: newContact })
  }

  // Bulk import
  const { emails } = body

  if (!emails || typeof emails !== 'string') {
    return NextResponse.json({ error: 'emails field is required' }, { status: 400 })
  }

  const lines = emails.trim().split('\n').filter((l: string) => l.trim())

  if (lines.length > 50) {
    return NextResponse.json({
      error: `Please limit to 50 contacts per batch. You submitted ${lines.length}.`,
    }, { status: 400 })
  }

  let added = 0
  let skipped = 0

  for (const line of lines) {
    const parts = line.split(',').map((s: string) => s.trim())
    const email = parts[0]?.toLowerCase()

    if (!email || !email.includes('@')) {
      skipped++
      continue
    }

    const firstName = parts[1] || null
    const lastName = parts[2] || null
    const emailMd5 = getMd5(email)

    const existing = await db.query.pitchList.findFirst({
      where: and(
        eq(pitchList.md5, emailMd5),
        eq(pitchList.groupId, group.id)
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    await db.insert(pitchList).values({
      groupId: group.id,
      companyId: co.id,
      userId,
      uuid: randomUUID().replace(/-/g, ''),
      firstName,
      lastName,
      email,
      md5: emailMd5,
      source: 'upload',
    })

    added++
  }

  return NextResponse.json({ success: true, added, skipped })
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

  const group = await getOrCreateGroup(co.id, userId, co.companyName)
  const body = await request.json()
  const { contactUuid, firstName, lastName, email, tld, publication, phone, notes, unsubscribed } = body

  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
  }
  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  if (!tld?.trim()) {
    return NextResponse.json({ error: 'Publication domain is required' }, { status: 400 })
  }

  const contact = await db.query.pitchList.findFirst({
    where: isAdmin
      ? and(eq(pitchList.uuid, contactUuid), eq(pitchList.companyId, co.id))
      : and(eq(pitchList.uuid, contactUuid), eq(pitchList.userId, userId)),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const newMd5 = getMd5(normalizedEmail)

  // Check for duplicate email within the same group (only if email changed)
  if (newMd5 !== contact.md5) {
    const duplicate = await db.query.pitchList.findFirst({
      where: and(
        eq(pitchList.md5, newMd5),
        eq(pitchList.groupId, group.id),
        sql`${pitchList.isDeleted} IS NOT TRUE`
      ),
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'A contact with this email already exists in your pitch list' },
        { status: 409 }
      )
    }
  }

  await db.update(pitchList)
    .set({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      md5: newMd5,
      tld: tld.trim().toLowerCase(),
      publication: publication?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      unsubscribeAt: unsubscribed ? (contact.unsubscribeAt || new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(pitchList.id, contact.id))

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
  const { contactUuid, contactUuids } = body

  // Bulk delete
  if (Array.isArray(contactUuids) && contactUuids.length > 0) {
    const uuids = contactUuids.filter((u: unknown) => typeof u === 'string' && u.length > 0)
    if (uuids.length === 0) {
      return NextResponse.json({ error: 'No valid UUIDs provided' }, { status: 400 })
    }

    await db.update(pitchList)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        inArray(pitchList.uuid, uuids),
        isAdmin ? eq(pitchList.companyId, co.id) : eq(pitchList.userId, userId)
      ))

    return NextResponse.json({ success: true, deleted: uuids.length })
  }

  // Single delete
  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid or contactUuids is required' }, { status: 400 })
  }

  const contact = await db.query.pitchList.findFirst({
    where: isAdmin
      ? and(eq(pitchList.uuid, contactUuid), eq(pitchList.companyId, co.id))
      : and(eq(pitchList.uuid, contactUuid), eq(pitchList.userId, userId)),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  await db.update(pitchList)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(pitchList.id, contact.id))

  return NextResponse.json({ success: true })
}
