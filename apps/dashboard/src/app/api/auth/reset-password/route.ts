import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users, verify } from '@/db/schema'
import { eq, and, gt, isNotNull } from 'drizzle-orm'
import { hash } from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Find token that is unused, has a userId, and is less than 1 hour old
    const verifyRecord = await db.query.verify.findFirst({
      where: and(
        eq(verify.uuid, token),
        eq(verify.verified, false),
        isNotNull(verify.userId),
        gt(verify.createdAt, new Date(Date.now() - 60 * 60 * 1000))
      ),
    })

    if (!verifyRecord || !verifyRecord.userId) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    // Hash new password
    const passwordHash = await hash(password, 12)

    // Update user password
    await db.update(users)
      .set({ passwordHash })
      .where(eq(users.id, verifyRecord.userId))

    // Mark token as used
    await db.update(verify)
      .set({ verified: true, verifiedBy: 'reset' })
      .where(eq(verify.id, verifyRecord.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
