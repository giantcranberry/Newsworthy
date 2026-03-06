import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { hash, compare } from 'bcryptjs'
import { NextResponse } from 'next/server'

// Verify Werkzeug-style password hashes (pbkdf2:sha256:...)
function verifyWerkzeugPassword(password: string, storedHash: string): boolean {
  try {
    if (storedHash.startsWith('pbkdf2:')) {
      const { pbkdf2Sync } = require('crypto')
      const parts = storedHash.split('$')
      if (parts.length !== 3) return false
      const methodPart = parts[0]
      const salt = parts[1]
      const hash = parts[2]
      const methodParts = methodPart.split(':')
      const hashMethod = methodParts[1] || 'sha256'
      const iterations = parseInt(methodParts[2] || '260000', 10)
      const derivedKey = pbkdf2Sync(password, salt, iterations, 32, hashMethod)
      return derivedKey.toString('hex') === hash
    }
    return false
  } catch {
    return false
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getEffectiveSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If user already has a password, verify the current one
    if (user.passwordHash) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required' },
          { status: 400 }
        )
      }

      let isValid = false
      if (user.passwordHash.startsWith('pbkdf2:')) {
        isValid = verifyWerkzeugPassword(currentPassword, user.passwordHash)
      } else {
        isValid = await compare(currentPassword, user.passwordHash)
      }

      if (!isValid) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 403 }
        )
      }
    }

    // Hash and save new password
    const newHash = await hash(newPassword, 12)
    await db.update(users)
      .set({ passwordHash: newHash })
      .where(eq(users.id, userId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    )
  }
}
