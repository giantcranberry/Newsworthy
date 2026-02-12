import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userSubscription, staffNotes, brandCredits } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
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
      newsdbCredits,
      managerFor,
      prPartner,
      imPartner,
      staffNote,
      emailVerified,
    } = body

    // If only toggling emailVerified, do a quick update and return
    if (typeof emailVerified === 'boolean' && Object.keys(body).length === 1) {
      await db
        .update(users)
        .set({ emailVerified })
        .where(eq(users.id, userId))
      return NextResponse.json({ success: true, emailVerified })
    }

    await db
      .update(users)
      .set({
        referredBy: referredBy || null,
        managerFor: managerFor ? parseInt(managerFor) : null,
        partnerId: prPartner ? parseInt(prPartner) : null,
        imPartnerId: imPartner ? parseInt(imPartner) : null,
        ...(typeof emailVerified === 'boolean' ? { emailVerified } : {}),
      })
      .where(eq(users.id, userId))

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
      })
    }

    const prCreditsNum = parseInt(prCredits) || 0
    if (prCreditsNum !== 0) {
      await db.insert(brandCredits).values({
        userId,
        companyId: null,
        prId: null,
        credits: prCreditsNum,
        productType: creditType || 'pr',
        notes: creditNotes?.substring(0, 48) || null,
      })
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
