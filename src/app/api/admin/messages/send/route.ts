import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userMessages, users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { sendMessageNotificationEmail } from '@/lib/email'

// POST: Send individual message to a user + optional email notification
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { toId, subject, body: messageBody } = body

  if (!toId || !subject?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: 'Recipient, subject, and body are required' }, { status: 400 })
  }

  const adminId = parseInt(session!.user!.id!)

  // Verify recipient exists
  const recipient = await db.query.users.findFirst({
    where: eq(users.id, toId),
  })

  if (!recipient) {
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }

  const recipientProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, toId),
  })

  // Insert the message
  let emailSent = false
  try {
    const recipientName = recipientProfile?.firstName || recipient.email

    await sendMessageNotificationEmail({
      to: recipient.email,
      recipientName,
    })
    emailSent = true
  } catch (err) {
    console.error('Failed to send message notification email:', err)
  }

  const [message] = await db.insert(userMessages).values({
    fromId: adminId,
    toId,
    subject: subject.trim(),
    body: messageBody,
    emailSent,
    createdAt: new Date(),
  }).returning()

  return NextResponse.json(message, { status: 201 })
}
