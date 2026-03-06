import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PUT(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      company,
      phone,
      mobile,
      addr1,
      addr2,
      city,
      state,
      postalCode,
      countryCode,
      isAgency,
    } = body

    // Check if profile exists
    const existingProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    if (existingProfile) {
      // Update profile
      await db.update(userProfiles)
        .set({
          firstName,
          lastName,
          company,
          phone,
          mobile,
          addr1,
          addr2,
          city,
          state,
          postalCode,
          countryCode,
        })
        .where(eq(userProfiles.userId, userId))
    } else {
      // Create profile
      await db.insert(userProfiles).values({
        userId,
        firstName,
        lastName,
        company,
        phone,
        mobile,
        addr1,
        addr2,
        city,
        state,
        postalCode,
        countryCode,
      })
    }

    // Update agency flag on users table
    if (typeof isAgency === 'boolean') {
      await db.update(users)
        .set({ isAgency })
        .where(eq(users.id, userId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
