import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userMessages, users, userProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { sendMessageNotificationEmail } from '@/lib/email'
import { sendSlackNotification, formatNewMessageAlert } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatNewMessageAlert } from '@/lib/google-chat'

// POST: Reply to a user message
export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const body = await request.json()
  const { messageId, body: replyBody } = body

  if (!messageId || !replyBody?.trim()) {
    return NextResponse.json({ error: 'Message ID and body are required' }, { status: 400 })
  }

  // Look up the original message — must be addressed to this user
  const original = await db.query.userMessages.findFirst({
    where: and(
      eq(userMessages.id, messageId),
      eq(userMessages.toId, userId)
    ),
  })

  if (!original) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (original.fromId === null) {
    return NextResponse.json({ error: 'Cannot reply to system messages' }, { status: 400 })
  }

  // Create the reply
  const subject = original.subject.startsWith('Re: ')
    ? original.subject
    : `Re: ${original.subject}`

  // Send email notification to the recipient
  let emailSent = false
  try {
    const recipient = await db.query.users.findFirst({
      where: eq(users.id, original.fromId),
    })
    const recipientProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, original.fromId),
    })

    if (recipient) {
      const recipientName = recipientProfile?.firstName || recipient.email

      await sendMessageNotificationEmail({
        to: recipient.email,
        recipientName,
        isReply: true,
      })
      emailSent = true
    }
  } catch (err) {
    console.error('Failed to send reply notification email:', err)
  }

  const [reply] = await db.insert(userMessages).values({
    fromId: userId,
    toId: original.fromId,
    subject,
    body: replyBody.trim(),
    emailSent,
    createdAt: new Date(),
  }).returning()

  // Slack notification for reply (best-effort)
  const senderProfile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })
  const senderName = senderProfile?.firstName || 'Someone'
  sendSlackNotification(original.fromId, formatNewMessageAlert(subject, senderName))
    .catch(err => console.error('[Slack] reply notification failed:', err))

  // Google Chat notification for reply (best-effort)
  sendGoogleChatNotification(original.fromId, formatGChatNewMessageAlert(subject, senderName))
    .catch(err => console.error('[GChat] reply notification failed:', err))

  return NextResponse.json(reply, { status: 201 })
}
