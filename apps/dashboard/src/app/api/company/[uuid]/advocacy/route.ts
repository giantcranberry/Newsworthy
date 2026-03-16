import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, advocacyGroups, crmContacts } from '@/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

function getMd5(email: string) {
  return createHash('md5').update(email.toLowerCase()).digest('hex')
}

const DEFAULT_INVITE_MSG =
  'The purpose of this advocacy group is to help bring more attention to our press releases. As a member of this advocacy group, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

async function getOrCreateGroup(companyId: number, userId: number, companyName: string) {
  let group = await db.query.advocacyGroups.findFirst({
    where: eq(advocacyGroups.coId, companyId),
  })

  if (!group) {
    const [newGroup] = await db.insert(advocacyGroups).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      coId: companyId,
      groupName: companyName,
      inviteMsg: DEFAULT_INVITE_MSG,
    }).returning()
    group = newGroup
  }

  return group
}

// GET: Fetch advocacy group + paginated advocates from crm_contacts
export async function GET(
  request: Request,
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

  const baseFilter = and(
    eq(crmContacts.companyId, co.id),
    inArray(crmContacts.contactType, ['advocate', 'both']),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  const allAdvocates = await db
    .select()
    .from(crmContacts)
    .where(baseFilter)
    .orderBy(desc(crmContacts.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(baseFilter)
  const totalCount = Number(countRow?.count || 0)

  return NextResponse.json({
    group: {
      id: group.id,
      uuid: group.uuid,
      groupName: group.groupName,
      inviteMsg: group.inviteMsg,
    },
    advocates: allAdvocates,
    total: totalCount,
    page,
    perPage,
    totalPages: Math.ceil(totalCount / perPage),
  })
}

// POST: Add advocates from email list → crm_contacts
export async function POST(
  request: Request,
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

  const { emails } = await request.json()

  if (!emails || typeof emails !== 'string') {
    return NextResponse.json({ error: 'emails field is required' }, { status: 400 })
  }

  const lines = emails.trim().split('\n').filter((l: string) => l.trim())

  if (lines.length > 100) {
    return NextResponse.json({
      error: `Please limit to 100 advocates per batch. You submitted ${lines.length}.`,
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

    // Check for duplicate in crm_contacts for this company
    const existing = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, emailMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (existing) {
      // If exists as media only, upgrade to 'both'
      if (existing.contactType === 'media') {
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
      userId: co.userId,
      companyId: co.id,
      contactType: 'advocate',
      email,
      md5: emailMd5,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
      source: 'upload',
    })

    added++
  }

  return NextResponse.json({ success: true, added, skipped })
}

// PUT: Update invite message
export async function PUT(
  request: Request,
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

  const { inviteMsg } = await request.json()

  if (typeof inviteMsg !== 'string') {
    return NextResponse.json({ error: 'inviteMsg is required' }, { status: 400 })
  }

  await db.update(advocacyGroups)
    .set({ inviteMsg, updatedAt: new Date() })
    .where(eq(advocacyGroups.id, group.id))

  return NextResponse.json({ success: true })
}

// PATCH: Edit an advocate → crm_contacts
export async function PATCH(
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

  const { advocateId, email, firstName, lastName, unsubscribed } = await request.json()

  if (!advocateId) {
    return NextResponse.json({ error: 'advocateId is required' }, { status: 400 })
  }

  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const advocate = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.id, advocateId),
      eq(crmContacts.companyId, co.id)
    ),
  })

  if (!advocate) {
    return NextResponse.json({ error: 'Advocate not found' }, { status: 404 })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const newMd5 = getMd5(normalizedEmail)

  // Check for duplicate email within the same company (only if email changed)
  if (newMd5 !== advocate.md5) {
    const duplicate = await db.query.crmContacts.findFirst({
      where: and(
        eq(crmContacts.md5, newMd5),
        eq(crmContacts.companyId, co.id),
        sql`${crmContacts.isDeleted} IS NOT TRUE`
      ),
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'This email address already exists in your contacts' },
        { status: 409 }
      )
    }
  }

  const fName = firstName?.trim() || null
  const lName = lastName?.trim() || null

  await db.update(crmContacts)
    .set({
      email: normalizedEmail,
      md5: newMd5,
      firstName: fName,
      lastName: lName,
      fullName: [fName, lName].filter(Boolean).join(' ') || null,
      unsubscribeAt: unsubscribed ? (advocate.unsubscribeAt || new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(crmContacts.id, advocate.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete advocates → crm_contacts
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
  const { advocateId, advocateIds } = body

  // Bulk delete
  if (Array.isArray(advocateIds) && advocateIds.length > 0) {
    const ids = advocateIds.map(Number).filter((n) => !isNaN(n))
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
    }

    await db.update(crmContacts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        inArray(crmContacts.id, ids),
        eq(crmContacts.companyId, co.id)
      ))

    return NextResponse.json({ success: true, deleted: ids.length })
  }

  // Single delete
  if (!advocateId) {
    return NextResponse.json({ error: 'advocateId or advocateIds is required' }, { status: 400 })
  }

  const advocate = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.id, advocateId),
      eq(crmContacts.companyId, co.id)
    ),
  })

  if (!advocate) {
    return NextResponse.json({ error: 'Advocate not found' }, { status: 404 })
  }

  await db.update(crmContacts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(crmContacts.id, advocate.id))

  return NextResponse.json({ success: true })
}
