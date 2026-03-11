import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userMessages, users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

// POST: Send individual message to a user + email with full content
export async function POST(request: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.isAdmin && !user?.isEditor && !user?.isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { toId, subject, body: messageBody, releaseId } = body

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

  // Send email with the full message content
  let emailSent = false
  try {
    const recipientName = recipientProfile?.firstName || recipient.email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
    const inboxLink = `${appUrl}/inbox`

    // Convert plain text newlines to <br> for HTML
    const htmlBody = messageBody.trim().replace(/\n/g, '<br>')

    await sendEmail({
      to: recipient.email,
      subject: subject.trim(),
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"><title>${subject.trim()}</title></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
              <h2 style="color: #1a1a1a; margin-bottom: 20px;">${subject.trim()}</h2>
              <p>Hi ${recipientName},</p>
              <div style="margin: 20px 0; padding: 16px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                ${htmlBody}
              </div>
              <a href="${inboxLink}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View in Dashboard</a>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy. If you believe this was sent in error, you can safely ignore it.</p>
            </div>
          </body>
        </html>
      `,
      text: `Hi ${recipientName},\n\n${messageBody.trim()}\n\nView in dashboard: ${inboxLink}`,
    })
    emailSent = true
  } catch (err) {
    console.error('Failed to send message email:', err)
  }

  // Also save to dashboard inbox
  const [message] = await db.insert(userMessages).values({
    fromId: adminId,
    toId,
    releaseId: releaseId || null,
    subject: subject.trim(),
    body: messageBody,
    emailSent,
    createdAt: new Date(),
  }).returning()

  return NextResponse.json(message, { status: 201 })
}
