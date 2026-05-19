import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, pitchGroups, crmContacts } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

function getMd5(email: string) {
  return createHash('md5').update(email.toLowerCase()).digest('hex')
}

// Parse a CSV line handling quoted fields (commas inside quotes)
function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current.trim())
  return fields
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

// GET: Fetch pitch group + paginated contacts from crm_contacts + stats
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
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

  const group = await getOrCreateGroup(co.id, userId, co.companyName)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = 40

  const notDeleted = and(
    eq(crmContacts.companyId, co.id),
    inArray(crmContacts.contactType, ['media', 'both']),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  const contacts = await db
    .select()
    .from(crmContacts)
    .where(notDeleted)
    .orderBy(desc(crmContacts.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(notDeleted)

  const [bouncedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(notDeleted, isNotNull(crmContacts.bouncedAt)))

  const [unsubRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(notDeleted, isNotNull(crmContacts.unsubscribeAt)))

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

// POST: Add contacts (bulk or single) → crm_contacts
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
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

  const body = await request.json()

  // Single contact add
  if (body.mode === 'single') {
    const { firstName, lastName, email, tld, publication, qurl, phone, notes } = body

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: 'First and last name are required' }, { status: 400 })
    }
    if (!email?.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
    }
    if (!tld?.trim()) {
      return NextResponse.json({ error: 'Publication domain is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const emailMd5 = getMd5(normalizedEmail)

    // Check for duplicate in crm_contacts for this company
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      // If exists as advocate only, upgrade to 'both'
      if (existing.contactType === 'advocate') {
        await db.update(crmContacts)
          .set({
            contactType: 'both',
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            fullName: `${firstName.trim()} ${lastName.trim()}`,
            tld: tld.trim().toLowerCase(),
            publication: publication?.trim() || existing.publication,
            qurl: qurl?.trim() || existing.qurl,
            phone: phone?.trim() || existing.phone,
            notes: notes?.trim() || existing.notes,
            updatedAt: new Date(),
          })
          .where(eq(crmContacts.id, existing.id))

        return NextResponse.json({ success: true, contact: existing })
      }
      return NextResponse.json({ error: 'A contact with this email already exists in your pitch list' }, { status: 409 })
    }

    const [newContact] = await db.insert(crmContacts).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      companyId: co.id,
      contactType: 'media',
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      email: normalizedEmail,
      md5: emailMd5,
      tld: tld.trim().toLowerCase(),
      publication: publication?.trim() || null,
      qurl: qurl?.trim() || null,
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
  const seenInBatch = new Set<string>()

  for (const line of lines) {
    const parts = parseCSVLine(line)
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
    // Skip empty optional fields so an empty column doesn't shift publication/url
    const optionalParts = parts.slice(3).filter(s => s.length > 0)
    const publication = optionalParts[0] || null
    const qurl = optionalParts[1] || null

    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      // If exists as advocate only, upgrade to 'both'
      if (existing.contactType === 'advocate') {
        await db.update(crmContacts)
          .set({ contactType: 'both', updatedAt: new Date() })
          .where(eq(crmContacts.id, existing.id))
        added++
      } else {
        skipped++
      }
      continue
    }

    await db.insert(crmContacts).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      companyId: co.id,
      contactType: 'media',
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
      email,
      md5: emailMd5,
      publication,
      qurl,
      source: 'upload',
    })

    added++
  }

  return NextResponse.json({ success: true, added, skipped })
}

// PUT: Update a contact → crm_contacts
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
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

  const body = await request.json()
  const { contactUuid, firstName, lastName, email, tld, publication, qurl, phone, notes, unsubscribed } = body

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
        { error: 'A contact with this email already exists in your pitch list' },
        { status: 409 }
      )
    }
  }

  await db.update(crmContacts)
    .set({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      email: normalizedEmail,
      md5: newMd5,
      tld: tld.trim().toLowerCase(),
      publication: publication?.trim() || null,
      qurl: qurl?.trim() || null,
      phone: phone?.trim() || null,
      notes: notes?.trim() || null,
      unsubscribeAt: unsubscribed ? (contact.unsubscribeAt || new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(crmContacts.id, contact.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete contacts → crm_contacts
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
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const co = access.company

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
