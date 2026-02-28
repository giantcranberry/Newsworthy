import { db } from '@/db'
import { userMessages, users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendMessageNotificationEmail } from '@/lib/email'

/**
 * Create a system-generated message for a user.
 * fromId is null for system messages — the inbox UI shows "Newsworthy" as the sender.
 */
export async function createSystemMessage(toId: number, subject: string, body: string) {
  await db.insert(userMessages).values({
    fromId: null,
    toId,
    subject,
    body,
    createdAt: new Date(),
  })
}

/**
 * Send a system message and email notification to a user.
 */
export async function sendSystemMessageWithEmail(toId: number, subject: string, body: string) {
  let emailSent = false

  try {
    const recipient = await db.query.users.findFirst({
      where: eq(users.id, toId),
    })
    if (recipient) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, toId),
      })
      const recipientName = profile?.firstName || recipient.email
      await sendMessageNotificationEmail({ to: recipient.email, recipientName })
      emailSent = true
    }
  } catch (err) {
    console.error('Failed to send notification email:', err)
  }

  await db.insert(userMessages).values({
    fromId: null,
    toId,
    subject,
    body,
    emailSent,
    createdAt: new Date(),
  })
}
