import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { companyMembers, companyInvites } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

// PUT: Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; memberId: string }> }
) {
  const { uuid, memberId } = await params
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
  const { role } = body

  const validRoles = ['brand_admin', 'collaborator', 'client']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const member = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.id, parseInt(memberId)),
      eq(companyMembers.companyId, access.company.id)
    ),
  })

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  await db.update(companyMembers)
    .set({ role })
    .where(eq(companyMembers.id, member.id))

  return NextResponse.json({ success: true })
}

// DELETE: Remove member or cancel invite
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string; memberId: string }> }
) {
  const { uuid, memberId } = await params
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

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'member'

  if (type === 'invite') {
    const invite = await db.query.companyInvites.findFirst({
      where: and(
        eq(companyInvites.id, parseInt(memberId)),
        eq(companyInvites.companyId, access.company.id)
      ),
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    await db.delete(companyInvites).where(eq(companyInvites.id, invite.id))
  } else {
    const member = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.id, parseInt(memberId)),
        eq(companyMembers.companyId, access.company.id)
      ),
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    await db.delete(companyMembers).where(eq(companyMembers.id, member.id))
  }

  return NextResponse.json({ success: true })
}
