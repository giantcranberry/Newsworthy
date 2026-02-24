import { db } from '@/db'
import { users, userProfiles, userSubscription, verify } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { sendVerificationEmail } from '@/lib/email'
import { addPersonToFolk } from '@/lib/folk'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, password } = body

    if (!firstName || !email || !password) {
      return NextResponse.json(
        { error: 'First name, email and password are required' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        emailVerified: false,
        regMethod: 'email',
        partnerId: 1,
        isAdmin: false,
        isDeleted: false,
        isSuper: false,
        isEditor: false,
        isStaff: false,
        isAccounting: false,
        isManager: false,
      })
      .returning()

    // Create profile
    await db.insert(userProfiles).values({
      userId: newUser.id,
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
    })

    // Create default subscription
    await db.insert(userSubscription).values({
      userId: newUser.id,
      startAt: new Date(),
    })

    // Create verification token
    const token = randomUUID().replace(/-/g, '')
    await db.insert(verify).values({
      userId: newUser.id,
      uuid: token,
      verified: false,
      createdAt: new Date(),
    })

    // Send verification email
    await sendVerificationEmail(normalizedEmail, token, firstName.trim())

    // Add to Folk CRM (non-blocking)
    addPersonToFolk({
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: (lastName || '').trim() || undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
