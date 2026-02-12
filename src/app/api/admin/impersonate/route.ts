import { auth, IMPERSONATE_COOKIE, IMPERSONATE_ADMIN_COOKIE } from '@/lib/auth'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Verify the target user exists
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, parseInt(userId)),
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Don't allow impersonating other admins
    if (targetUser.isAdmin) {
      return NextResponse.json({ error: 'Cannot impersonate admin users' }, { status: 403 })
    }

    const cookieStore = await cookies()

    // Set impersonation cookies
    cookieStore.set(IMPERSONATE_COOKIE, userId.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
    })

    cookieStore.set(IMPERSONATE_ADMIN_COOKIE, session?.user?.id || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 4, // 4 hours
    })

    return NextResponse.json({
      success: true,
      message: `Now impersonating user ${targetUser.email}`
    })
  } catch (error) {
    console.error('[API] Impersonation error:', error)
    return NextResponse.json({ error: 'Failed to impersonate user' }, { status: 500 })
  }
}

export async function DELETE() {
  const cookieStore = await cookies()

  // Check if we're actually impersonating
  const impersonateUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value

  if (!impersonateUserId) {
    return NextResponse.json({ error: 'Not impersonating anyone' }, { status: 400 })
  }

  // Clear impersonation cookies
  cookieStore.delete(IMPERSONATE_COOKIE)
  cookieStore.delete(IMPERSONATE_ADMIN_COOKIE)

  return NextResponse.json({ success: true, message: 'Stopped impersonation' })
}

export async function GET() {
  const session = await auth()
  const cookieStore = await cookies()

  const impersonateUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value
  const adminId = cookieStore.get(IMPERSONATE_ADMIN_COOKIE)?.value

  if (!impersonateUserId) {
    return NextResponse.json({ impersonating: false })
  }

  // Get impersonated user info
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, parseInt(impersonateUserId)),
  })

  const profile = targetUser ? await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, targetUser.id),
  }) : null

  return NextResponse.json({
    impersonating: true,
    userId: impersonateUserId,
    userEmail: targetUser?.email,
    userName: profile ? `${profile.firstName} ${profile.lastName}` : targetUser?.email,
    adminId,
  })
}
