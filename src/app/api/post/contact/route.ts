import { db } from '@/db'
import { releaseEmails, releases, contactFormLogs, userMessages, users, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, sendMessageNotificationEmail } from '@/lib/email'

async function verifyRecaptcha(token: string): Promise<boolean> {
  const apiKey = process.env.RECAPTCHA_API_KEY
  if (!apiKey) {
    console.error('RECAPTCHA_API_KEY not configured')
    return false
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT
  if (!projectId) {
    console.error('GOOGLE_CLOUD_PROJECT not configured')
    return false
  }

  const res = await fetch(
    `https://recaptchaenterprise.googleapis.com/v1/projects/${projectId}/assessments?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          token,
          siteKey: process.env.RECAPTCHA_SITE_KEY!,
          expectedAction: 'CONTACT_FORM',
        },
      }),
    }
  )

  if (!res.ok) {
    console.error('reCAPTCHA assessment failed:', await res.text())
    return false
  }

  const data = await res.json()

  if (!data.tokenProperties?.valid) {
    console.error('reCAPTCHA token invalid:', data.tokenProperties?.invalidReason)
    return false
  }

  // Score 0.0 = very likely bot, 1.0 = very likely human. Reject below 0.5.
  const score = data.riskAnalysis?.score ?? 0
  if (score < 0.5) {
    console.warn('reCAPTCHA score too low:', score)
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { slug, name, email, phone, subject, message, recaptchaToken } = body

  // Validate required fields
  if (!slug || !name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Name, email, subject, and message are required' }, { status: 400 })
  }

  // Verify reCAPTCHA
  if (!recaptchaToken) {
    return NextResponse.json({ error: 'reCAPTCHA verification required' }, { status: 400 })
  }

  const isHuman = await verifyRecaptcha(recaptchaToken)
  if (!isHuman) {
    return NextResponse.json({ error: 'reCAPTCHA verification failed. Please try again.' }, { status: 403 })
  }

  // Parse slug: "{md5Hash}-{prId}"
  const lastDash = slug.lastIndexOf('-')
  if (lastDash === -1) {
    return NextResponse.json({ error: 'Invalid contact link' }, { status: 400 })
  }

  const md5Hash = slug.substring(0, lastDash)
  const prId = parseInt(slug.substring(lastDash + 1), 10)

  if (!md5Hash || isNaN(prId)) {
    return NextResponse.json({ error: 'Invalid contact link' }, { status: 400 })
  }

  // Look up the target email
  const emailRecord = await db.query.releaseEmails.findFirst({
    where: eq(releaseEmails.md5Hash, md5Hash),
  })

  if (!emailRecord) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Fetch the release to get owner info
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, prId),
  })

  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  const targetEmail = emailRecord.email
  const releaseTitle = release.title || 'Untitled Press Release'
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || null

  // Log to contact_form_logs
  await db.insert(contactFormLogs).values({
    releaseId: release.id,
    emailHash: md5Hash,
    targetEmail,
    senderName: name.trim(),
    senderEmail: email.trim(),
    senderPhone: phone?.trim() || null,
    subject: subject.trim(),
    message: message.trim(),
    ipAddress,
  })

  // Build HTML body for the inbox message
  const phoneRow = phone?.trim()
    ? `<tr><td style="padding:4px 8px;font-weight:600;vertical-align:top;">Phone:</td><td style="padding:4px 8px;">${escapeHtml(phone.trim())}</td></tr>`
    : ''

  const messageHtml = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>A visitor submitted a contact form regarding your press release <strong>${escapeHtml(releaseTitle)}</strong>.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 8px;font-weight:600;vertical-align:top;">Name:</td><td style="padding:4px 8px;">${escapeHtml(name.trim())}</td></tr>
        <tr><td style="padding:4px 8px;font-weight:600;vertical-align:top;">Email:</td><td style="padding:4px 8px;"><a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></td></tr>
        ${phoneRow}
        <tr><td style="padding:4px 8px;font-weight:600;vertical-align:top;">Subject:</td><td style="padding:4px 8px;">${escapeHtml(subject.trim())}</td></tr>
      </table>
      <div style="background:#f8f9fa;padding:16px;border-radius:6px;margin:16px 0;">
        <p style="margin:0;white-space:pre-wrap;">${escapeHtml(message.trim())}</p>
      </div>
    </div>
  `.trim()

  // Insert inbox message for the release owner
  await db.insert(userMessages).values({
    fromId: null,
    toId: release.userId,
    subject: `Contact Form: ${subject.trim()}`,
    body: messageHtml,
    emailSent: false,
    createdAt: new Date(),
  })

  // Send notification email to the release owner
  try {
    const owner = await db.query.users.findFirst({
      where: eq(users.id, release.userId),
    })

    if (owner) {
      const ownerProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, release.userId),
      })
      const recipientName = ownerProfile?.firstName || owner.email

      await sendMessageNotificationEmail({
        to: owner.email,
        recipientName,
      })
    }
  } catch (err) {
    console.error('Failed to send owner notification email:', err)
  }

  // Send confirmation email to the submitter
  try {
    const confirmationHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>Message Confirmation</title></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
            <h1 style="color: #1a1a1a; margin-bottom: 20px;">Message Received</h1>
            <p>Hi ${escapeHtml(name.trim())},</p>
            <p>Thank you for reaching out. Your message has been delivered. Here is a copy for your records:</p>
            <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin: 20px 0;">
              <p><strong>Subject:</strong> ${escapeHtml(subject.trim())}</p>
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap;">${escapeHtml(message.trim())}</p>
            </div>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #999;">This is an automated confirmation from Newsworthy.</p>
          </div>
        </body>
      </html>
    `

    await sendEmail({
      to: email.trim(),
      subject: `Message Confirmation: ${subject.trim()}`,
      html: confirmationHtml,
      text: `Hi ${name.trim()},\n\nThank you for reaching out. Your message has been delivered.\n\nSubject: ${subject.trim()}\n\nMessage:\n${message.trim()}\n\nThis is an automated confirmation from Newsworthy.`,
    })
  } catch (err) {
    console.error('Failed to send confirmation email:', err)
  }

  return NextResponse.json({ success: true })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
