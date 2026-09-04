import { Resend } from 'resend'
import { db } from '@/db'
import { emailTemplates } from '@/db/schema'
import { eq } from 'drizzle-orm'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}
const fromEmail = process.env.RESEND_FROM_EMAIL || 'support@newsworthyai.com'

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string
  subject: string
  html: string
  text?: string
}) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured')
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: `Newsworthy <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text || '',
    })

    if (error) {
      console.error('[Resend] Error sending email:', error)
      const message =
        typeof error === 'object' && error && 'message' in error
          ? String((error as { message: string }).message)
          : 'Resend rejected the email'
      throw new Error(message)
    }

    console.log('[Resend] Email sent', { to, subject, id: data?.id })
    return data
  } catch (error) {
    console.error('[Resend] Failed to send email:', error)
    throw error
  }
}

/** Public app base URL for links in outbound email (production: app.newsworthyai.com). */
export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.DASHBOARD_URL ||
    'https://app.newsworthyai.com'
  ).replace(/\/$/, '')
}

/**
 * Load an email template from the database by slug.
 * Returns null if not found (caller should fall back to hardcoded).
 */
async function getTemplate(slug: string) {
  try {
    return await db.query.emailTemplates.findFirst({
      where: eq(emailTemplates.slug, slug),
    }) || null
  } catch {
    return null
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Replace {{variable}} placeholders in a template string.
 */
function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match
  })
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/magic-link?token=${token}&email=${encodeURIComponent(email)}`

  const tmpl = await getTemplate('magic-link')
  if (tmpl) {
    const vars = { magicLink }
    await sendEmail({
      to: email,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Sign in to Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">Sign in to Newsworthy</h1>
          <p style="margin-bottom: 20px;">Click the button below to sign in to your account. This link will expire in 24 hours.</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in</a>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">This link can only be used once and expires in 24 hours.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Sign in to Newsworthy',
    html,
    text: `Sign in to Newsworthy\n\nClick this link to sign in: ${magicLink}\n\nThis link expires in 24 hours.`,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

  const tmpl = await getTemplate('password-reset')
  if (tmpl) {
    const vars = { resetLink }
    await sendEmail({
      to: email,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Reset your password</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">Reset your password</h1>
          <p style="margin-bottom: 20px;">Click the button below to reset your password. This link will expire in 1 hour.</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Reset your Newsworthy password',
    html,
    text: `Reset your password\n\nClick this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`,
  })
}

export async function sendPaymentReceiptEmail({
  to,
  customerName,
  releaseTitle,
  releaseUuid,
  productNames,
  amount,
  transactionId,
}: {
  to: string
  customerName: string
  releaseTitle: string
  releaseUuid: string
  productNames: string[]
  amount: number
  transactionId: string
}) {
  const formattedAmount = `$${(amount / 100).toFixed(2)}`
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://newsworthyai.com'

  const productListHtml = productNames
    .map(name => `<li style="padding: 4px 0;">${name}</li>`)
    .join('')

  const productListText = productNames.map(name => `  - ${name}`).join('\n')

  const tmpl = await getTemplate('payment-receipt')
  if (tmpl) {
    const vars = { date, transactionId, customerName, releaseTitle, releaseUuid, productListHtml, productListText, formattedAmount, appUrl }
    await sendEmail({
      to,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Receipt - Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a1a; margin: 0;">Payment Receipt</h1>
            <p style="color: #666; margin: 5px 0;">Thank you for your purchase!</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Transaction ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500; font-family: monospace; font-size: 12px;">${transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;">Customer:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 500;">${customerName}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Press Release</h3>
            <p style="margin: 0 0 5px 0; font-weight: 600;">${releaseTitle}</p>
            <p style="margin: 0; font-size: 12px; color: #666; font-family: monospace;">ID: ${releaseUuid}</p>
          </div>

          <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Upgrades Purchased</h3>
            <ul style="margin: 0; padding-left: 20px; color: #333;">
              ${productListHtml}
            </ul>
          </div>

          <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 6px; text-align: center;">
            <p style="margin: 0; font-size: 14px;">Amount Paid</p>
            <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold;">${formattedAmount}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${appUrl}/pr/${releaseUuid}/review" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Press Release</a>
          </div>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            This receipt was sent from Newsworthy. If you have any questions, please contact us at support@newsworthyai.com.
          </p>
        </div>
      </body>
    </html>
  `

  const text = `
Payment Receipt - Newsworthy

Thank you for your purchase!

Date: ${date}
Transaction ID: ${transactionId}
Customer: ${customerName}

Press Release: ${releaseTitle}
Release ID: ${releaseUuid}

Upgrades Purchased:
${productListText}

Amount Paid: ${formattedAmount}

View your press release: ${appUrl}/pr/${releaseUuid}/review

If you have any questions, please contact us at support@newsworthyai.com.
  `.trim()

  await sendEmail({
    to,
    subject: `Payment Receipt - ${releaseTitle}`,
    html,
    text,
  })
}

/**
 * Stakeholder approval request — always sent via Resend.
 */
export async function sendApprovalRequestEmail({
  to,
  approverName,
  requestorName,
  releaseTitle,
  notes,
  approvalUuid,
}: {
  to: string
  approverName: string
  requestorName: string
  releaseTitle: string
  notes?: string | null
  approvalUuid: string
}) {
  const approvalLink = `${getAppBaseUrl()}/approval/${approvalUuid}`
  const safeApprover = escapeHtml(approverName)
  const safeRequestor = escapeHtml(requestorName)
  const safeTitle = escapeHtml(releaseTitle)
  const safeNotes = notes ? escapeHtml(notes) : ''

  const notesHtml = notes
    ? `<div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Message from ${safeRequestor}:</h3>
        <p style="margin: 0; color: #333; font-style: italic;">"${safeNotes}"</p>
      </div>`
    : ''

  const notesText = notes ? `\nMessage from ${requestorName}:\n"${notes}"\n` : ''

  const tmpl = await getTemplate('approval-request')
  if (tmpl) {
    const vars = {
      approverName: safeApprover,
      requestorName: safeRequestor,
      releaseTitle: safeTitle,
      notesHtml,
      notesText,
      approvalLink,
    }
    await sendEmail({
      to,
      subject: renderTemplate(tmpl.subject, {
        approverName,
        requestorName,
        releaseTitle,
        notesHtml,
        notesText,
        approvalLink,
      }),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody
        ? renderTemplate(tmpl.textBody, {
            approverName,
            requestorName,
            releaseTitle,
            notesHtml,
            notesText,
            approvalLink,
          })
        : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Approval Requested - Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1a1a1a; margin: 0;">Your Approval is Requested</h1>
          </div>

          <p style="margin-bottom: 20px;">Hi ${safeApprover},</p>

          <p style="margin-bottom: 20px;">
            <strong>${safeRequestor}</strong> has requested your approval for a press release before it is distributed.
          </p>

          <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Press Release</h3>
            <p style="margin: 0; font-weight: 600; color: #333;">${safeTitle}</p>
          </div>

          ${notesHtml}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${approvalLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Press Release</a>
          </div>

          <p style="font-size: 14px; color: #666; margin-top: 20px;">
            Click the button above to review the press release and provide your feedback. You can approve or decline the release directly from the page.
          </p>

          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

          <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
            This email was sent from Newsworthy on behalf of ${safeRequestor}. If you believe this was sent in error, you can safely ignore it.
          </p>
        </div>
      </body>
    </html>
  `

  const text = `
Your Approval is Requested

Hi ${approverName},

${requestorName} has requested your approval for a press release before it is distributed.

Press Release: ${releaseTitle}
${notesText}
Click the link below to review the press release and provide your feedback:
${approvalLink}

You can approve or decline the release directly from the page.

This email was sent from Newsworthy on behalf of ${requestorName}. If you believe this was sent in error, you can safely ignore it.
  `.trim()

  await sendEmail({
    to,
    subject: `Approval Requested: ${releaseTitle}`,
    html,
    text,
  })
}

export async function sendVerificationEmail(email: string, token: string, name: string) {
  const verifyLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`

  const tmpl = await getTemplate('verification')
  if (tmpl) {
    const vars = { name, verifyLink }
    await sendEmail({
      to: email,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Verify your email - Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">Verify your email</h1>
          <p>Hi ${name},</p>
          <p style="margin-bottom: 20px;">Thanks for signing up for Newsworthy! Please verify your email address by clicking the button below.</p>
          <a href="${verifyLink}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email</a>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">This link expires in 24 hours.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Verify your email - Newsworthy',
    html,
    text: `Verify your email\n\nHi ${name},\n\nThanks for signing up for Newsworthy! Please verify your email by clicking this link:\n\n${verifyLink}\n\nThis link expires in 24 hours.`,
  })
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  companyName,
  role,
  token,
}: {
  to: string
  inviterName: string
  companyName: string
  role: string
  token: string
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
  const inviteLink = `${appUrl}/invite/${token}`

  const roleLabels: Record<string, string> = {
    brand_admin: 'Brand Admin',
    collaborator: 'Collaborator',
    client: 'Client',
  }
  const roleLabel = roleLabels[role] || role

  const tmpl = await getTemplate('team-invite')
  if (tmpl) {
    const vars = { inviterName, companyName, roleLabel, inviteLink }
    await sendEmail({
      to,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>You've been invited to join a team - Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">You've been invited to a team</h1>
          <p style="margin-bottom: 20px;">
            <strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on Newsworthy as a <strong>${roleLabel}</strong>.
          </p>
          <a href="${inviteLink}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">This invitation expires in 7 days. If you don't have an account, you'll be able to create one.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy on behalf of ${inviterName}. If you believe this was sent in error, you can safely ignore it.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to,
    subject: `You've been invited to join ${companyName} on Newsworthy`,
    html,
    text: `You've been invited to a team\n\n${inviterName} has invited you to join ${companyName} on Newsworthy as a ${roleLabel}.\n\nAccept the invitation: ${inviteLink}\n\nThis invitation expires in 7 days.`,
  })
}

export async function sendMessageNotificationEmail({
  to,
  recipientName,
  isReply,
}: {
  to: string
  recipientName: string
  isReply?: boolean
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
  const inboxLink = `${appUrl}/inbox`
  const heading = isReply ? 'You have a new reply' : 'You have a new message'
  const description = isReply
    ? 'Someone replied to your message on Newsworthy. Log in to view it.'
    : 'You have a new message waiting for you on Newsworthy. Log in to view it.'

  const tmpl = await getTemplate('message-notification')
  if (tmpl) {
    const vars = { recipientName, heading, description, inboxLink }
    await sendEmail({
      to,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${heading} - Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">${heading}</h1>
          <p>Hi ${recipientName},</p>
          <p style="margin-bottom: 20px;">${description}</p>
          <a href="${inboxLink}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Inbox</a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy. If you believe this was sent in error, you can safely ignore it.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to,
    subject: `${heading} on Newsworthy`,
    html,
    text: `Hi ${recipientName},\n\n${description}\n\nView your inbox: ${inboxLink}`,
  })
}

export async function sendWelcomeEmail(email: string, name: string) {
  const dashboardLink = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

  const tmpl = await getTemplate('welcome')
  if (tmpl) {
    const vars = { name, dashboardLink }
    await sendEmail({
      to: email,
      subject: renderTemplate(tmpl.subject, vars),
      html: renderTemplate(tmpl.htmlBody, vars),
      text: tmpl.textBody ? renderTemplate(tmpl.textBody, vars) : undefined,
    })
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Newsworthy</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to Newsworthy!</h1>
          <p>Hi ${name},</p>
          <p style="margin-bottom: 20px;">Thanks for joining Newsworthy! We're excited to help you with your press release distribution needs.</p>
          <p style="margin-bottom: 20px;">Here's what you can do:</p>
          <ul style="margin-bottom: 20px;">
            <li>Create and distribute press releases</li>
            <li>Access our media database</li>
            <li>Connect with influencers</li>
            <li>Track your press coverage</li>
          </ul>
          <a href="${dashboardLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Go to Dashboard</a>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Welcome to Newsworthy!',
    html,
    text: `Welcome to Newsworthy!\n\nHi ${name},\n\nThanks for joining Newsworthy! We're excited to help you with your press release distribution needs.`,
  })
}

const BOOK_PDF_URL = 'https://shareworthy.link/to/nmPDF'
const BOOK_EPUB_URL = 'https://shareworthy.link/to/nmEPUB'
const ONBOARDING_URL = 'https://tidycal.com/newsmarketer/30-minute-meeting'

/**
 * Welcome gift email with direct News Marketing ebook download links.
 * Sent after new account registration (no extra signup required).
 */
export async function sendNewsMarketingBookEmail(email: string, firstName?: string) {
  const greeting = firstName?.trim() ? `Hi ${firstName.trim()},` : 'Hi there,'
  const subject = firstName?.trim()
    ? `${firstName.trim()}, your free News Marketing book is ready`
    : 'Your free News Marketing book is ready'

  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your free News Marketing book</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1f2937;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">
                <tr>
                  <td style="background-color: #155e75; padding: 28px 32px;">
                    <p style="margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #a5f3fc;">Welcome gift</p>
                    <h1 style="margin: 8px 0 0; font-size: 24px; line-height: 1.3; color: #ffffff;">Your free copy of News Marketing</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 16px;">${greeting}</p>
                    <p style="margin: 0 0 16px;">Thank you for joining the Newsworthy.ai community. We look forward to helping you get your brand discovered.</p>
                    <p style="margin: 0 0 24px;">As a welcome gift, download <strong>News Marketing</strong> — my book on the 28-day discipline that keeps brands findable in search and AI. These are direct download links; no extra registration needed.</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 12px;">
                      <tr>
                        <td style="border-radius: 8px; background-color: #155e75;">
                          <a href="${BOOK_PDF_URL}" style="display: inline-block; padding: 14px 22px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">Download PDF</a>
                        </td>
                      </tr>
                    </table>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                      <tr>
                        <td style="border-radius: 8px; border: 1px solid #155e75;">
                          <a href="${BOOK_EPUB_URL}" style="display: inline-block; padding: 13px 22px; font-size: 15px; font-weight: 600; color: #155e75; text-decoration: none;">Download ePub</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0 0 8px; font-size: 14px; color: #4b5563;">Prefer plain links?</p>
                    <p style="margin: 0 0 24px; font-size: 14px; color: #4b5563;">
                      PDF: <a href="${BOOK_PDF_URL}" style="color: #155e75;">${BOOK_PDF_URL}</a><br>
                      ePub: <a href="${BOOK_EPUB_URL}" style="color: #155e75;">${BOOK_EPUB_URL}</a>
                    </p>
                    <p style="margin: 0 0 24px;">Feel free to share these links with teammates, colleagues, and friends.</p>
                    <hr style="margin: 0 0 24px; border: none; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0 0 16px;">Want a free one-on-one walkthrough of your Newsworthy account? Book a short session with me:</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 28px;">
                      <tr>
                        <td style="border-radius: 8px; background-color: #111827;">
                          <a href="${ONBOARDING_URL}" style="display: inline-block; padding: 12px 20px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">Book a 30-minute session</a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 0;">Sincerely,</p>
                    <p style="margin: 4px 0 0; font-weight: 600;">David McInnis<br><span style="font-weight: 400; color: #6b7280;">Founder, Newsworthy.ai</span></p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 0 32px 28px;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">This email was sent from Newsworthy.ai because you created an account.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `

  const text = `${greeting}

Thank you for joining the Newsworthy.ai community. We look forward to helping you get your brand discovered.

As a welcome gift, download News Marketing — my book on the 28-day discipline that keeps brands findable in search and AI. Direct download links (no extra registration):

PDF: ${BOOK_PDF_URL}
ePub: ${BOOK_EPUB_URL}

Feel free to share these links with teammates, colleagues, and friends.

Want a free one-on-one walkthrough of your Newsworthy account?
Book a 30-minute session: ${ONBOARDING_URL}

Sincerely,
David McInnis
Founder, Newsworthy.ai`

  await sendEmail({
    to: email,
    subject,
    html,
    text,
  })
}

/**
 * Notify a user that their account was permanently deleted, including the
 * admin-provided reason. Must be sent before the user row is removed.
 */
export async function sendAccountDeletedEmail({
  email,
  name,
  reason,
}: {
  email: string
  name?: string | null
  reason: string
}) {
  const greetingName = name?.trim() || 'there'
  const safeReason = escapeHtml(reason.trim())
  const reasonText = reason.trim()
  const subject = 'Your Newsworthy account has been deleted'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
          <h1 style="color: #1a1a1a; margin-bottom: 20px;">Account deleted</h1>
          <p>Hi ${escapeHtml(greetingName)},</p>
          <p style="margin-bottom: 20px;">
            Your Newsworthy account associated with <strong>${escapeHtml(email)}</strong>
            has been permanently deleted.
          </p>
          <p style="margin-bottom: 8px;"><strong>Reason:</strong></p>
          <p style="margin-bottom: 20px; padding: 12px 16px; background: #fff; border-left: 3px solid #dc2626; white-space: pre-wrap;">${safeReason}</p>
          <p style="margin-bottom: 20px; font-size: 14px; color: #666;">
            If you believe this was done in error, please contact support at
            <a href="mailto:support@newsworthyai.com">support@newsworthyai.com</a>.
          </p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject,
    html,
    text: `Account deleted\n\nHi ${greetingName},\n\nYour Newsworthy account associated with ${email} has been permanently deleted.\n\nReason:\n${reasonText}\n\nIf you believe this was done in error, contact support@newsworthyai.com.`,
  })
}

const ADMIN_INVOICE_CC = 'admin@mail.newsworthy.ai'

/** Copy of a newly sent admin invoice — Stripe cannot CC Billing emails via API. */
export async function sendInvoiceAdminCopyEmail({
  customerEmail,
  customerName,
  userId,
  invoiceNumber,
  invoiceId,
  amountDue,
  dueDate,
  description,
  memo,
  hostedInvoiceUrl,
  invoicePdf,
}: {
  customerEmail: string
  customerName: string
  userId: number
  invoiceNumber: string | null
  invoiceId: string
  amountDue: number
  dueDate: number | null
  description: string
  memo: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
}) {
  const formattedAmount = `$${(amountDue / 100).toFixed(2)}`
  const numberLabel = invoiceNumber || invoiceId
  const dueLabel = dueDate
    ? new Date(dueDate * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://newsworthyai.com'
  const adminUserUrl = `${appUrl}/admin/users/${userId}`

  const safeName = escapeHtml(customerName)
  const safeEmail = escapeHtml(customerEmail)
  const safeDesc = escapeHtml(description)
  const safeMemo = memo ? escapeHtml(memo) : ''

  const linksHtml = [
    hostedInvoiceUrl
      ? `<p><a href="${escapeHtml(hostedInvoiceUrl)}">View hosted invoice</a></p>`
      : '',
    invoicePdf ? `<p><a href="${escapeHtml(invoicePdf)}">Download PDF</a></p>` : '',
  ]
    .filter(Boolean)
    .join('')

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; line-height: 1.5;">
        <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
          <h1 style="font-size: 18px; margin: 0 0 16px;">Invoice sent</h1>
          <p style="margin: 0 0 12px;">An invoice was emailed to the customer.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #666;">Invoice</td><td style="padding: 6px 0; text-align: right;"><strong>${escapeHtml(numberLabel)}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Customer</td><td style="padding: 6px 0; text-align: right;">${safeName} &lt;${safeEmail}&gt;</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Amount due</td><td style="padding: 6px 0; text-align: right;"><strong>${formattedAmount}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Due date</td><td style="padding: 6px 0; text-align: right;">${dueLabel}</td></tr>
            <tr><td style="padding: 6px 0; color: #666; vertical-align: top;">Line item</td><td style="padding: 6px 0; text-align: right;">${safeDesc}</td></tr>
            ${
              safeMemo
                ? `<tr><td style="padding: 6px 0; color: #666; vertical-align: top;">Memo</td><td style="padding: 6px 0; text-align: right; white-space: pre-wrap;">${safeMemo}</td></tr>`
                : ''
            }
          </table>
          ${linksHtml}
          <p style="margin: 16px 0 0; font-size: 13px; color: #666;">
            <a href="${escapeHtml(adminUserUrl)}">Open user in admin</a>
          </p>
        </div>
      </body>
    </html>
  `

  const textLines = [
    'Invoice sent',
    '',
    `Invoice: ${numberLabel}`,
    `Customer: ${customerName} <${customerEmail}>`,
    `Amount due: ${formattedAmount}`,
    `Due date: ${dueLabel}`,
    `Line item: ${description}`,
    memo ? `Memo: ${memo}` : null,
    hostedInvoiceUrl ? `Hosted invoice: ${hostedInvoiceUrl}` : null,
    invoicePdf ? `PDF: ${invoicePdf}` : null,
    `Admin: ${adminUserUrl}`,
  ].filter(Boolean)

  await sendEmail({
    to: ADMIN_INVOICE_CC,
    subject: `Invoice ${numberLabel} sent to ${customerEmail} (${formattedAmount})`,
    html,
    text: textLines.join('\n'),
  })
}
