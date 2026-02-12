import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, advocacyGroups, advocates } from '@/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

const DEFAULT_INVITE_MSG =
  'The purpose of this advocacy group is to help bring more attention to our press releases. As a member of this advocacy group, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

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

// GET: Fetch advocacy group + paginated advocates
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const group = await getOrCreateGroup(co.id, userId, co.companyName)

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = 40

  const allAdvocates = await db
    .select()
    .from(advocates)
    .where(and(
      eq(advocates.groupId, group.id),
      sql`${advocates.isDeleted} IS NOT TRUE`
    ))
    .orderBy(desc(advocates.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(advocates)
    .where(and(
      eq(advocates.groupId, group.id),
      sql`${advocates.isDeleted} IS NOT TRUE`
    ))
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

// POST: Add advocates from email list
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const group = await getOrCreateGroup(co.id, userId, co.companyName)

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

  for (const line of lines) {
    const parts = line.split(',').map((s: string) => s.trim())
    const email = parts[0]?.toLowerCase()

    if (!email || !email.includes('@')) {
      skipped++
      continue
    }

    const firstName = parts[1] || null
    const lastName = parts[2] || null

    // Check for duplicate
    const existing = await db.query.advocates.findFirst({
      where: and(
        eq(advocates.email, email),
        eq(advocates.groupId, group.id)
      ),
    })

    if (existing) {
      skipped++
      continue
    }

    await db.insert(advocates).values({
      groupId: group.id,
      userId: co.userId,
      uuid: randomUUID().replace(/-/g, ''),
      email,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

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

// PATCH: Edit an advocate
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const { advocateId, email, firstName, lastName, unsubscribed } = await request.json()

  if (!advocateId) {
    return NextResponse.json({ error: 'advocateId is required' }, { status: 400 })
  }

  if (!email?.trim() || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }

  const advocate = await db.query.advocates.findFirst({
    where: and(
      eq(advocates.id, advocateId),
      eq(advocates.userId, co.userId)
    ),
  })

  if (!advocate) {
    return NextResponse.json({ error: 'Advocate not found' }, { status: 404 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check for duplicate email within the same group (only if email changed)
  if (normalizedEmail !== advocate.email) {
    const duplicate = await db.query.advocates.findFirst({
      where: and(
        eq(advocates.email, normalizedEmail),
        eq(advocates.groupId, advocate.groupId!),
        sql`${advocates.isDeleted} IS NOT TRUE`
      ),
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'This email address already exists in this advocacy group' },
        { status: 409 }
      )
    }
  }

  const fName = firstName?.trim() || null
  const lName = lastName?.trim() || null

  await db.update(advocates)
    .set({
      email: normalizedEmail,
      firstName: fName,
      lastName: lName,
      fullName: [fName, lName].filter(Boolean).join(' ') || null,
      unsubscribeAt: unsubscribed ? (advocate.unsubscribeAt || new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(advocates.id, advocate.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete an advocate
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
  const { advocateId, advocateIds } = body

  // Bulk delete
  if (Array.isArray(advocateIds) && advocateIds.length > 0) {
    const ids = advocateIds.map(Number).filter((n) => !isNaN(n))
    if (ids.length === 0) {
      return NextResponse.json({ error: 'No valid IDs provided' }, { status: 400 })
    }

    await db.update(advocates)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(
        inArray(advocates.id, ids),
        eq(advocates.userId, co.userId)
      ))

    return NextResponse.json({ success: true, deleted: ids.length })
  }

  // Single delete
  if (!advocateId) {
    return NextResponse.json({ error: 'advocateId or advocateIds is required' }, { status: 400 })
  }

  const advocate = await db.query.advocates.findFirst({
    where: and(
      eq(advocates.id, advocateId),
      eq(advocates.userId, co.userId)
    ),
  })

  if (!advocate) {
    return NextResponse.json({ error: 'Advocate not found' }, { status: 404 })
  }

  await db.update(advocates)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(advocates.id, advocate.id))

  return NextResponse.json({ success: true })
}
