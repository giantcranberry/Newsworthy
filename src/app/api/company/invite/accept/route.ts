import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { companyInvites, companyMembers, company } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

// POST: Accept an invitation
export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const userEmail = session.user.email?.toLowerCase()

  const body = await request.json()
  const { token } = body

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const invite = await db.query.companyInvites.findFirst({
    where: and(
      eq(companyInvites.token, token),
      isNull(companyInvites.acceptedAt),
    ),
  })

  if (!invite) {
    return NextResponse.json({ error: 'Invitation not found or already accepted' }, { status: 404 })
  }

  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
  }

  if (invite.email !== userEmail) {
    return NextResponse.json(
      { error: 'This invitation was sent to a different email address' },
      { status: 403 }
    )
  }

  // Check not already a member
  const existingMember = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, invite.companyId),
      eq(companyMembers.userId, userId)
    ),
  })

  if (existingMember) {
    // Mark invite as accepted anyway
    await db.update(companyInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(companyInvites.id, invite.id))

    const co = await db.query.company.findFirst({
      where: eq(company.id, invite.companyId),
      columns: { uuid: true },
    })

    return NextResponse.json({ success: true, companyUuid: co?.uuid, alreadyMember: true })
  }

  // Insert member and mark invite accepted
  await db.insert(companyMembers).values({
    companyId: invite.companyId,
    userId,
    role: invite.role,
    invitedBy: invite.invitedBy,
  })

  await db.update(companyInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(companyInvites.id, invite.id))

  const co = await db.query.company.findFirst({
    where: eq(company.id, invite.companyId),
    columns: { uuid: true },
  })

  return NextResponse.json({ success: true, companyUuid: co?.uuid })
}
