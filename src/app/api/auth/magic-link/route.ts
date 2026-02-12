import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, verify } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!token || !email) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
  }

  try {
    // Find the verification record
    const verifyRecord = await db.query.verify.findFirst({
      where: and(
        eq(verify.uuid, token),
        eq(verify.verified, false),
        gt(verify.createdAt, new Date(Date.now() - 15 * 60 * 1000)) // 15 minutes
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
      salt: 'authjs.session-token',
    })

    // Set cookie and redirect
    const cookieStore = await cookies()
    cookieStore.set('next-auth.session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/',
    })

    return NextResponse.redirect(new URL('/dashboard', request.url))
  } catch (error) {
    console.error('Magic link error:', error)
    return NextResponse.redirect(new URL('/login?error=server_error', request.url))
  }
}
