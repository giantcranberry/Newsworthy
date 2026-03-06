import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { verify } from '@/db/schema'
import { sendMagicLinkEmail } from '@/lib/email'
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

    // Create verification token
    const token = uuidv4().replace(/-/g, '')

    await db.insert(verify).values({
      uuid: token,
      verified: false,
      createdAt: new Date(),
    })

    // Send magic link email
    await sendMagicLinkEmail(normalizedEmail, token)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send magic link error:', error)
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    )
  }
}
