import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userSubscription, staffNotes, brandCredits, partnerManagers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { createSystemMessage } from '@/lib/messages'
import { hash } from 'bcryptjs'
import { permanentlyDeleteUser } from '@/lib/admin-permanent-delete-user'
import { sendAccountDeletedEmail } from '@/lib/email'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  const sessionUserId = Number((session?.user as any)?.id)
  if (sessionUserId === userId) {
    return NextResponse.json({ error: 'You cannot permanently delete your own account' }, { status: 400 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const confirmEmail = typeof body?.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    if (!body?.confirmPermanent || !confirmEmail) {
      return NextResponse.json(
        { error: 'Confirmation required. This is a permanent delete.' },
        { status: 400 },
      )
    }
    if (reason.length < 10) {
      return NextResponse.json(
        { error: 'A deletion reason of at least 10 characters is required. It will be emailed to the user.' },
        { status: 400 },
      )
    }

    const [target] = await db
      .select({ id: users.id, email: users.email, isAdmin: users.isAdmin, isSuper: users.isSuper })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (target.isAdmin || target.isSuper) {
      return NextResponse.json({ error: 'Admin accounts cannot be permanently deleted' }, { status: 403 })
    }
    if (confirmEmail !== target.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email confirmation does not match. Permanent delete aborted.' },
        { status: 400 },
      )
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: { firstName: true, lastName: true },
    })
    const displayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null

    // Email before hard-delete so the address still exists and the user is notified.
    try {
      await sendAccountDeletedEmail({
        email: target.email,
        name: displayName,
        reason,
      })
    } catch (err) {
      console.error('Failed to send account-deleted email:', err)
      return NextResponse.json(
        { error: 'Could not email the user the deletion reason. Account was not deleted — try again.' },
        { status: 502 },
      )
    }

    const result = await permanentlyDeleteUser(userId)
    return NextResponse.json({ success: true, emailSent: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to permanently delete user'
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (message === 'CANNOT_DELETE_ADMIN') {
      return NextResponse.json({ error: 'Admin accounts cannot be permanently deleted' }, { status: 403 })
    }
    console.error('Error permanently deleting user:', error)
    return NextResponse.json({ error: 'Failed to permanently delete user' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userId = parseInt(id)

  if (isNaN(userId)) {
    return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      referredBy,
      prCredits,
      creditType,
      creditNotes,
      creditCompanyId,
      newsdbCredits,
      managedPartnerIds,
      prPartner,
      imPartner,
      staffNote,
      emailVerified,
      resetPassword,
      roles,
    } = body

    // Password reset — admin or editor only
    if (resetPassword) {
      if (!isAdmin && !isEditor) {
        return NextResponse.json({ error: 'Only admins and editors can reset passwords' }, { status: 403 })
      }
      if (typeof resetPassword !== 'string' || resetPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
      }
      const newHash = await hash(resetPassword, 12)
      await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId))
      return NextResponse.json({ success: true })
    }

    // If only toggling emailVerified, do a quick update and return
    if (typeof emailVerified === 'boolean' && Object.keys(body).length === 1) {
      await db
        .update(users)
        .set({ emailVerified })
        .where(eq(users.id, userId))
      return NextResponse.json({ success: true, emailVerified })
    }

    // Build user update fields
    const userUpdate: Record<string, any> = {
      referredBy: referredBy || null,
      partnerId: prPartner ? parseInt(prPartner) : null,
      imPartnerId: imPartner ? parseInt(imPartner) : null,
      ...(typeof emailVerified === 'boolean' ? { emailVerified } : {}),
    }

    // Role changes — admin or editor only
    if (roles && (isAdmin || isEditor)) {
      if (typeof roles.isAdmin === 'boolean') userUpdate.isAdmin = roles.isAdmin
      if (typeof roles.isEditor === 'boolean') userUpdate.isEditor = roles.isEditor
      if (typeof roles.isStaff === 'boolean') userUpdate.isStaff = roles.isStaff
    }

    await db
      .update(users)
      .set(userUpdate)
      .where(eq(users.id, userId))

    // Update partner_managers junction table
    if (Array.isArray(managedPartnerIds)) {
      // Delete existing rows for this user
      await db.delete(partnerManagers).where(eq(partnerManagers.userId, userId))
      // Insert new rows
      if (managedPartnerIds.length > 0) {
        await db.insert(partnerManagers).values(
          managedPartnerIds.map((pid: number) => ({
            userId,
            partnerId: pid,
          }))
        )
      }
    }

    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    if (existingProfile) {
      await db
        .update(userProfiles)
        .set({
          firstName: firstName || null,
          lastName: lastName || null,
        })
        .where(eq(userProfiles.userId, userId))
    } else {
      await db.insert(userProfiles).values({
        userId,
        firstName: firstName || null,
        lastName: lastName || null,
      })
    }

    const existingSubscription = await db.query.userSubscription.findFirst({
      where: eq(userSubscription.userId, userId),
    })

    if (existingSubscription) {
      await db
        .update(userSubscription)
        .set({
          newsdbCredits: parseInt(newsdbCredits) || 0,
        })
        .where(eq(userSubscription.userId, userId))
    } else {
      await db.insert(userSubscription).values({
        userId,
        newsdbCredits: parseInt(newsdbCredits) || 0,
        startAt: new Date(),
      })
    }

    const prCreditsNum = parseInt(prCredits) || 0
    if (prCreditsNum !== 0) {
      const type = creditType || 'pr'
      const companyIdNum = creditCompanyId ? parseInt(creditCompanyId, 10) : null

      if (type === 'podcast_pr' && (!companyIdNum || Number.isNaN(companyIdNum))) {
        return NextResponse.json(
          { error: 'A brand must be selected to apply Podcast PR credits' },
          { status: 400 }
        )
      }

      // Podcast PR credits expire 2 years from issue. Other types are perpetual.
      const expiresAt =
        type === 'podcast_pr'
          ? new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000)
          : null

      await db.insert(brandCredits).values({
        userId,
        companyId: companyIdNum,
        prId: null,
        credits: prCreditsNum,
        productType: type,
        notes: creditNotes?.substring(0, 48) || null,
        expiresAt,
      })

      // Send system message notification
      try {
        const typeLabel =
          type === 'pr'
            ? 'PR'
            : type === 'podcast_pr'
            ? 'Podcast PR'
            : type
        await createSystemMessage(
          userId,
          'Credits added to your account',
          `${prCreditsNum} ${typeLabel} credits have been added to your account.`
        )
      } catch (err) {
        console.error('Failed to create system message for credits:', err)
      }
    }

    if (staffNote && staffNote.trim().length >= 10) {
      const staffName = session?.user?.name || session?.user?.email || 'Staff'
      await db.insert(staffNotes).values({
        userId,
        staffName: staffName.substring(0, 32),
        body: staffNote.trim(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
