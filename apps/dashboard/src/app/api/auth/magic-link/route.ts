import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, verify } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { getPostHog } from '@/lib/posthog'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!token || !email) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
  }

  try {
    // Find token that is unused and less than 15 minutes old
    const verifyRecord = await db.query.verify.findFirst({
      where: and(
        eq(verify.uuid, token),
        eq(verify.verified, false),
        gt(verify.createdAt, new Date(Date.now() - 15 * 60 * 1000))
      ),
    })

    if (!verifyRecord) {
      return NextResponse.redirect(new URL('/login?error=expired_link', request.url))
    }

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })

    if (!user) {
      // Create new user for magic link sign in
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        emailVerified: true,
        regMethod: 'magic',
        partnerId: 1,
      }).returning()
      user = newUser
    } else {
      // Update email verified
      await db.update(users)
        .set({ emailVerified: true })
        .where(eq(users.id, user.id))
    }

    // Mark verification as used
    await db.update(verify)
      .set({ verified: true, verifiedBy: 'email' })
      .where(eq(verify.id, verifyRecord.id))

    // In production (HTTPS), NextAuth uses __Secure- prefix for cookies
    const isSecure = process.env.NODE_ENV === 'production'
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

    // Create session token
    const sessionToken = await encode({
      token: {
        id: user.id.toString(),
        email: user.email,
        isAdmin: user.isAdmin,
        isEditor: user.isEditor,
        isStaff: user.isStaff,
        partnerId: user.partnerId,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      salt: cookieName,
    })

    // Set cookie and redirect
    const cookieStore = await cookies()
    cookieStore.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    const posthog = getPostHog()
    const distinctId = String(user.id)
    posthog.identify({
      distinctId,
      properties: {
        email: user.email,
        $set: { email_verified: true },
      },
    })
    posthog.capture({
      distinctId,
      event: 'user_logged_in',
      properties: { method: 'magic_link' },
    })

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Magic link error:', error)
    getPostHog().captureException(error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
