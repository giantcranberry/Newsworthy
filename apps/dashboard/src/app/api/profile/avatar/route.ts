import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { uploadUserAvatar, deleteLogo } from '@/services/s3'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const formData = await request.formData()
    const file = formData.get('avatar') as File | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and WebP files are supported' }, { status: 400 })
    }

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Delete old avatar if exists
    if (profile.avatar) {
      await deleteLogo(profile.avatar)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const avatarUrl = await uploadUserAvatar(buffer, userId, file.type)

    await db.update(userProfiles)
      .set({ avatar: avatarUrl })
      .where(eq(userProfiles.userId, userId))

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error) {
    console.error('[API] Error uploading user avatar:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.avatar) {
      await deleteLogo(profile.avatar)
    }

    await db.update(userProfiles)
      .set({ avatar: null })
      .where(eq(userProfiles.userId, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error removing user avatar:', error)
    return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 })
  }
}
