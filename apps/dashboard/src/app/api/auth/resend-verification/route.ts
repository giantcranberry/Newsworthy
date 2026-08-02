import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, verify } from '@/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sendVerificationEmail } from '@/lib/email'

// Re-send the email-verification link for the signed-in user. Optionally
// accepts { newEmail } so an unverified user who mistyped their address can
// correct it — the link then goes to the corrected address.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.emailVerified) {
      return NextResponse.json({ verified: true })
    }

    let email = user.email

    const body = await request.json().catch(() => ({}))
    const newEmail = typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : ''

    if (newEmail && newEmail !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
      }

      const taken = await db.query.users.findFirst({
        where: and(eq(users.email, newEmail), ne(users.id, userId)),
        columns: { id: true },
      })
      if (taken) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }

      // Only allowed while unverified (checked above) — correcting a typo
      await db.update(users).set({ email: newEmail }).where(eq(users.id, userId))
      email = newEmail
    }

    const token = randomUUID().replace(/-/g, '')
    await db.insert(verify).values({
      userId,
      uuid: token,
      verified: false,
      createdAt: new Date(),
    })

    await sendVerificationEmail(email, token, session.user.name || email)

    return NextResponse.json({ success: true, email })
  } catch (error) {
    console.error('Error resending verification email:', error)
    return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
  }
}
