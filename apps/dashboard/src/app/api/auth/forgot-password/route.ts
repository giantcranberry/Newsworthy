import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, verify } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendPasswordResetEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Look up user - but always return success to prevent enumeration
    const user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })

    if (user && user.passwordHash) {
      const token = uuidv4().replace(/-/g, '')

      await db.insert(verify).values({
        userId: user.id,
        uuid: token,
        verified: false,
        createdAt: new Date(),
      })

      await sendPasswordResetEmail(normalizedEmail, token)
    }

    // Always return success
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
