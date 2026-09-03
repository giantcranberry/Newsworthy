import { db } from '@/db'
import { users, userProfiles, userSubscription, verify, partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { sendVerificationEmail, sendNewsMarketingBookEmail } from '@/lib/email'
import { addContactToCrmWorthy } from '@/lib/crmworthy'
import { getPostHog } from '@/lib/posthog'
import { sendSmsNotification } from '@/lib/twilio'
import {
  COMPANY_EMAIL_REQUIRED_MESSAGE,
  isBlockedRegistrationEmail,
} from '@/lib/registration-email'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, phone, password, partnerId } = body

    if (!firstName || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'First name, email, phone number and password are required' },
        { status: 400 }
      )
    }

    const normalizedPhone = String(phone).trim()
    const phoneDigits = normalizedPhone.replace(/\D/g, '')
    const phoneValid = normalizedPhone.startsWith('+')
      ? phoneDigits.length >= 7 && phoneDigits.length <= 15
      : phoneDigits.length === 10 || (phoneDigits.length === 11 && phoneDigits.startsWith('1'))

    if (!phoneValid) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number' },
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

    if (isBlockedRegistrationEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: COMPANY_EMAIL_REQUIRED_MESSAGE },
        { status: 400 }
      )
    }

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

    // Validate partnerId if provided
    let validPartnerId = 1
    let partnerName: string | undefined
    if (partnerId) {
      const partner = await db.query.partners.findFirst({
        where: and(
          eq(partners.id, partnerId),
          eq(partners.isActive, true),
        ),
      })
      if (partner) {
        validPartnerId = partner.id
        partnerName = partner.company || partner.brandName || partner.handle || undefined
      }
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        uuid: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        emailVerified: false,
        regMethod: 'email',
        partnerId: validPartnerId,
        createdAt: new Date(),
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
      phone: normalizedPhone,
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

    // Welcome gift: News Marketing ebook download links (non-blocking)
    sendNewsMarketingBookEmail(normalizedEmail, firstName.trim()).catch((err) =>
      console.error('Failed to send News Marketing book email:', err)
    )

    // Add to CRMWorthy CRM (non-blocking)
    addContactToCrmWorthy({
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: (lastName || '').trim() || undefined,
      partner: partnerName,
      sourceId: newUser.uuid,
    })

    // SMS notification (non-blocking)
    sendSmsNotification(`New account registered: ${firstName.trim()} ${(lastName || '').trim()} (${normalizedEmail})`)

    // Log the new user in immediately (same pattern as verify-email): set the
    // NextAuth session cookie server-side so the client can go straight to
    // /dashboard. Email verification is enforced later, at release submission.
    try {
      const isSecure = process.env.NODE_ENV === 'production'
      const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token'

      const sessionToken = await encode({
        token: {
          id: newUser.id.toString(),
          email: newUser.email,
          isAdmin: false,
          isEditor: false,
          isStaff: false,
          partnerId: newUser.partnerId,
        },
        secret: process.env.NEXTAUTH_SECRET!,
        salt: cookieName,
      })

      const cookieStore = await cookies()
      cookieStore.set(cookieName, sessionToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      })
    } catch (sessionError) {
      // Non-fatal: the user can still sign in manually
      console.error('Failed to create session after registration:', sessionError)
    }

    const posthog = getPostHog()
    const distinctId = String(newUser.id)
    posthog.identify({
      distinctId,
      properties: {
        email: normalizedEmail,
        name: `${firstName.trim()} ${(lastName || '').trim()}`.trim(),
        $set_once: { first_seen: new Date().toISOString() },
      },
    })
    posthog.capture({
      distinctId,
      event: 'user_registered',
      properties: {
        reg_method: 'email',
        partner_id: validPartnerId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Registration error:', error)
    getPostHog().captureException(error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}
