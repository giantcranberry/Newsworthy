import { db } from '@/db'
import { users, userProfiles, userSubscription, verify, partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encode } from 'next-auth/jwt'
import { sendVerificationEmail, sendEmail } from '@/lib/email'
import { addContactToSalesNexus } from '@/lib/salesnexus'
import { getPostHog } from '@/lib/posthog'
import { sendSmsNotification } from '@/lib/twilio'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { firstName, lastName, email, password, partnerId } = body

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
        email: normalizedEmail,
        passwordHash,
        emailVerified: false,
        regMethod: 'email',
        partnerId: validPartnerId,
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

    // Send welcome email (non-blocking)
    sendEmail({
      to: normalizedEmail,
      subject: "Your Newsworthy.ai account is ready — book your free onboarding",
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>Welcome to Newsworthy.ai</title></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h1 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to Newsworthy.ai</h1>
              <p>Hello,</p>
              <p>Thank you for creating your account.</p>
              <p>I'd like to personally walk you through your account setup. This is a free one-on-one session directly with me, the founder of Newsworthy.ai. I'll help you optimize your account for our AI features so that your brand is discoverable in both AI and SEO.</p>
              <a href="https://tidycal.com/newsmarketer/30-minute-meeting" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0;">Book a 30-Minute Session</a>
              <p style="margin-top: 24px;">David McInnis, Founder</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy.ai</p>
            </div>
          </body>
        </html>
      `,
      text: `Hello,\n\nThank you for creating your account.\n\nI'd like to personally walk you through your account setup. This is a free one-on-one session directly with me, the founder of Newsworthy.ai. I'll help you optimize your account for our AI features so that your brand is discoverable in both AI and SEO.\n\nBook a 30-minute session: https://tidycal.com/newsmarketer/30-minute-meeting\n\nDavid McInnis, Founder`,
    }).catch(err => console.error('Failed to send welcome email:', err))

    // Add to SalesNexus CRM (non-blocking)
    addContactToSalesNexus({
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: (lastName || '').trim() || undefined,
      partner: partnerName,
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
