import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
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
  try {
    const { data, error } = await resend.emails.send({
      from: `Newsworthy <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text: text || '',
    })

    if (error) {
      console.error('Error sending email:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/magic-link?token=${token}&email=${encodeURIComponent(email)}`

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
          <p style="margin-bottom: 20px;">Click the button below to sign in to your account. This link will expire in 15 minutes.</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in</a>
          <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #999;">This link can only be used once and expires in 15 minutes.</p>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: email,
    subject: 'Sign in to Newsworthy',
    html,
    text: `Sign in to Newsworthy\n\nClick this link to sign in: ${magicLink}\n\nThis link expires in 15 minutes.`,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
  const approvalLink = `${appUrl}/approval/${approvalUuid}`

  const notesHtml = notes
    ? `<div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Message from ${requestorName}:</h3>
        <p style="margin: 0; color: #333; font-style: italic;">"${notes}"</p>
      </div>`
    : ''

  const notesText = notes ? `\nMessage from ${requestorName}:\n"${notes}"\n` : ''

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

          <p style="margin-bottom: 20px;">Hi ${approverName},</p>

          <p style="margin-bottom: 20px;">
            <strong>${requestorName}</strong> has requested your approval for a press release before it is distributed.
          </p>

          <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
            <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Press Release</h3>
            <p style="margin: 0; font-weight: 600; color: #333;">${releaseTitle}</p>
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
            This email was sent from Newsworthy on behalf of ${requestorName}. If you believe this was sent in error, you can safely ignore it.
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

export async function sendWelcomeEmail(email: string, name: string) {
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
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Go to Dashboard</a>
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
