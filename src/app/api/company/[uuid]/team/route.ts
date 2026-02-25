import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { companyMembers, companyInvites, users, userProfiles } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { randomUUID, randomBytes } from 'crypto'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { sendTeamInviteEmail } from '@/lib/email'

// GET: List members + pending invites
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

  if (!hasMinRole(access.role, 'client')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get owner info
  const owner = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(eq(users.id, access.company.userId))
    .then(rows => rows[0])

  // Get members
  const members = await db
    .select({
      id: companyMembers.id,
      userId: companyMembers.userId,
      role: companyMembers.role,
      createdAt: companyMembers.createdAt,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, companyMembers.userId))
    .where(eq(companyMembers.companyId, access.company.id))

  // Get pending invites (not accepted, not expired)
  const invites = await db
    .select({
      id: companyInvites.id,
      email: companyInvites.email,
      role: companyInvites.role,
      createdAt: companyInvites.createdAt,
      expiresAt: companyInvites.expiresAt,
    })
    .from(companyInvites)
    .where(and(
      eq(companyInvites.companyId, access.company.id),
      isNull(companyInvites.acceptedAt),
    ))

  return NextResponse.json({
    owner: owner ? {
      id: owner.id,
      email: owner.email,
      name: [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email,
      role: 'owner',
    } : null,
    members: members.map(m => ({
      id: m.id,
      userId: m.userId,
      email: m.email,
      name: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
      role: m.role,
      createdAt: m.createdAt,
    })),
    invites: invites.map(i => ({
      id: i.id,
      email: i.email,
      role: i.role,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
    })),
    currentUserRole: access.role,
  })
}

// POST: Send invitation
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

  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { email, role } = body

  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const validRoles = ['brand_admin', 'collaborator', 'client']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const normalizedEmail = email.trim().toLowerCase()

  // Check if user is already the owner
  const ownerUser = await db.query.users.findFirst({
    where: eq(users.id, access.company.userId),
  })
  if (ownerUser && ownerUser.email === normalizedEmail) {
    return NextResponse.json({ error: 'This user is already the brand owner' }, { status: 409 })
  }

  // Check if already a member
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  })
  if (existingUser) {
    const existingMember = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.companyId, access.company.id),
        eq(companyMembers.userId, existingUser.id)
      ),
    })
    if (existingMember) {
      return NextResponse.json({ error: 'This user is already a team member' }, { status: 409 })
    }
  }

  // Check for existing pending invite
  const existingInvite = await db.query.companyInvites.findFirst({
    where: and(
      eq(companyInvites.companyId, access.company.id),
      eq(companyInvites.email, normalizedEmail),
      isNull(companyInvites.acceptedAt),
    ),
  })
  if (existingInvite) {
    return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  await db.insert(companyInvites).values({
    uuid: randomUUID(),
    companyId: access.company.id,
    email: normalizedEmail,
    role,
    invitedBy: userId,
    token,
    expiresAt,
  })

  // Send invite email
  const inviterProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })
  const inviterName = [inviterProfile?.firstName, inviterProfile?.lastName].filter(Boolean).join(' ') || session.user.email || 'A team member'

  try {
    await sendTeamInviteEmail({
      to: normalizedEmail,
      inviterName,
      companyName: access.company.companyName,
      role,
      token,
    })
  } catch (err) {
    console.error('Failed to send invite email:', err)
    // Don't fail the whole request if email fails — invite is still created
  }

  return NextResponse.json({ success: true })
}
