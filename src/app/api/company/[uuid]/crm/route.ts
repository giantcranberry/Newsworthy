import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, crmContacts } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, inArray, ilike, or } from 'drizzle-orm'
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

// GET: Fetch paginated CRM contacts with search, filter, and stats
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

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const perPage = [10, 20, 50].includes(Number(searchParams.get('perPage'))) ? Number(searchParams.get('perPage')) : 20
  const query = searchParams.get('q')?.trim() || ''
  const contactType = searchParams.get('type') || ''
  const statusFilter = searchParams.get('status') || ''

  const baseFilter = and(
    eq(crmContacts.companyId, co.id),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  let combinedFilter = baseFilter

  // Contact type filter
  if (contactType === 'media') {
    combinedFilter = and(combinedFilter, inArray(crmContacts.contactType, ['media', 'both']))
  } else if (contactType === 'advocate') {
    combinedFilter = and(combinedFilter, inArray(crmContacts.contactType, ['advocate', 'both']))
  }

  // Search filter
  if (query) {
    combinedFilter = and(combinedFilter, or(
      ilike(crmContacts.email, `%${query}%`),
      ilike(crmContacts.firstName, `%${query}%`),
      ilike(crmContacts.lastName, `%${query}%`),
      ilike(crmContacts.publication, `%${query}%`)
    ))
  }

  // Status filter
  if (statusFilter === 'active') {
    combinedFilter = and(combinedFilter, isNull(crmContacts.bouncedAt), isNull(crmContacts.unsubscribeAt))
  } else if (statusFilter === 'bounced') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.bouncedAt))
  } else if (statusFilter === 'unsubscribed') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.unsubscribeAt))
  }

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(combinedFilter)
    .orderBy(desc(crmContacts.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(combinedFilter)

  // Stats — always unfiltered (company-scoped only)
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(baseFilter)

  const [bouncedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, isNotNull(crmContacts.bouncedAt)))

  const [unsubRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, isNotNull(crmContacts.unsubscribeAt)))

  const [mediaRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, inArray(crmContacts.contactType, ['media', 'both'])))

  const [advocateRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, inArray(crmContacts.contactType, ['advocate', 'both'])))

  const total = Number(totalRow?.count || 0)
  const bounced = Number(bouncedRow?.count || 0)
  const unsubscribed = Number(unsubRow?.count || 0)
  const active = total - bounced - unsubscribed
  const filtered = Number(countRow?.count || 0)

  return NextResponse.json({
    contacts,
    stats: {
      total,
      active,
      bounced,
      unsubscribed,
      media: Number(mediaRow?.count || 0),
      advocates: Number(advocateRow?.count || 0),
    },
    filtered,
    page,
    perPage,
    totalPages: Math.ceil(filtered / perPage),
  })
}

// POST: Add single contact or bulk text import
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

  const body = await request.json()

  // Single contact add
  if (body.mode === 'single') {
    const { firstName, lastName, email, tld, publication, phone, notes, contactType } = body
    const type = contactType || 'media'

    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const emailMd5 = getMd5(normalizedEmail)

    // Check for duplicate
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      return NextResponse.json({ error: 'A contact with this email already exists' }, { status: 409 })
    }

    const fName = firstName?.trim() || null
    const lName = lastName?.trim() || null

    const [newContact] = await db.insert(crmContacts).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      companyId: co.id,
      contactType: type,
      firstName: fName,
      lastName: lName,
      fullName: [fName, lName].filter(Boolean).join(' ') || null,
      email: normalizedEmail,
      md5: emailMd5,
      tld: tld?.trim()?.toLowerCase() || null,
      publication: publication?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      source: 'single',
    }).returning()

    return NextResponse.json({ success: true, contact: newContact })
  }

  // Bulk text import (email per line)
  const { emails, contactType } = body
  const type = contactType || 'media'

  if (!emails || typeof emails !== 'string') {
    return NextResponse.json({ error: 'emails field is required' }, { status: 400 })
  }

  const lines = emails.trim().split('\n').filter((l: string) => l.trim())

  if (lines.length > 100) {
    return NextResponse.json({
      error: `Please limit to 100 contacts per batch. You submitted ${lines.length}.`,
    }, { status: 400 })
  }

  let added = 0
  let skipped = 0
  const seenInBatch = new Set<string>()

  for (const line of lines) {
    const parts = line.split(',').map((s: string) => s.trim())
    const email = parts[0]?.toLowerCase()

    if (!email || !email.includes('@')) {
      skipped++
      continue
    }

    const emailMd5 = getMd5(email)

    // Within-batch dedup
    if (seenInBatch.has(emailMd5)) {
      skipped++
      continue
    }
    seenInBatch.add(emailMd5)

    const firstName = parts[1] || null
    const lastName = parts[2] || null

    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    await db.insert(crmContacts).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      companyId: co.id,
      contactType: type,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
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

  const body = await request.json()
  const { contactUuid, firstName, lastName, email, tld, publication, phone, notes, contactType, unsubscribed } = body

  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
  }
  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const contact = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.uuid, contactUuid),
      eq(crmContacts.companyId, co.id)
    ),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const newMd5 = getMd5(normalizedEmail)

  // Check for duplicate email within the same company (only if email changed)
  if (newMd5 !== contact.md5) {
    const duplicate = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, newMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'A contact with this email already exists' },
        { status: 409 }
      )
    }
  }

  const fName = firstName?.trim() || null
  const lName = lastName?.trim() || null

  await db.update(crmContacts)
    .set({
      firstName: fName,
      lastName: lName,
      fullName: [fName, lName].filter(Boolean).join(' ') || null,
      email: normalizedEmail,
      md5: newMd5,
      tld: tld?.trim()?.toLowerCase() || null,
      publication: publication?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      contactType: contactType || contact.contactType,
      unsubscribeAt: unsubscribed ? (contact.unsubscribeAt || new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(crmContacts.id, contact.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete contacts (single or bulk)
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

    await db.update(crmContacts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        inArray(crmContacts.uuid, uuids),
        eq(crmContacts.companyId, co.id)
      ))

    return NextResponse.json({ success: true, deleted: uuids.length })
  }

  // Single delete
  if (!contactUuid) {
    return NextResponse.json({ error: 'contactUuid or contactUuids is required' }, { status: 400 })
  }

  const contact = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.uuid, contactUuid),
      eq(crmContacts.companyId, co.id)
    ),
  })

  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  await db.update(crmContacts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(crmContacts.id, contact.id))

  return NextResponse.json({ success: true })
}
