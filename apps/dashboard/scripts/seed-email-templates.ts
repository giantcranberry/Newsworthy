/**
 * Seed script: Populate email_templates table with all system email templates.
 *
 * Usage: bun scripts/seed-email-templates.ts
 *
 * This inserts all transactional email templates from the codebase into the
 * email_templates table so they can be edited via the admin UI.
 * Uses ON CONFLICT to skip already-seeded templates (safe to re-run).
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../src/db/schema'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const client = postgres(DATABASE_URL)
const db = drizzle(client, { schema })

const templates = [
  {
    slug: 'magic-link',
    name: 'Magic Link Sign-In',
    description: 'Sent when a user requests a passwordless sign-in link',
    subject: 'Sign in to Newsworthy',
    variables: '{{magicLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Sign in to Newsworthy</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">Sign in to Newsworthy</h1>
      <p style="margin-bottom: 20px;">Click the button below to sign in to your account. This link will expire in 24 hours.</p>
      <a href="{{magicLink}}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in</a>
      <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">This link can only be used once and expires in 24 hours.</p>
    </div>
  </body>
</html>`,
    textBody: `Sign in to Newsworthy\n\nClick this link to sign in: {{magicLink}}\n\nThis link expires in 24 hours.`,
  },
  {
    slug: 'password-reset',
    name: 'Password Reset',
    description: 'Sent when a user requests to reset their password',
    subject: 'Reset your Newsworthy password',
    variables: '{{resetLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Reset your password</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">Reset your password</h1>
      <p style="margin-bottom: 20px;">Click the button below to reset your password. This link will expire in 1 hour.</p>
      <a href="{{resetLink}}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset Password</a>
      <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't request this email, you can safely ignore it.</p>
    </div>
  </body>
</html>`,
    textBody: `Reset your password\n\nClick this link to reset your password: {{resetLink}}\n\nThis link expires in 1 hour.`,
  },
  {
    slug: 'payment-receipt',
    name: 'Payment Receipt',
    description: 'Sent after a successful payment for press release upgrades',
    subject: 'Payment Receipt - {{releaseTitle}}',
    variables: '{{date}}, {{transactionId}}, {{customerName}}, {{releaseTitle}}, {{releaseUuid}}, {{productListHtml}}, {{formattedAmount}}, {{appUrl}}',
    htmlBody: `<!DOCTYPE html>
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
            <td style="padding: 8px 0; text-align: right; font-weight: 500;">{{date}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Transaction ID:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 500; font-family: monospace; font-size: 12px;">{{transactionId}}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Customer:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 500;">{{customerName}}</td>
          </tr>
        </table>
      </div>
      <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Press Release</h3>
        <p style="margin: 0 0 5px 0; font-weight: 600;">{{releaseTitle}}</p>
        <p style="margin: 0; font-size: 12px; color: #666; font-family: monospace;">ID: {{releaseUuid}}</p>
      </div>
      <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 15px 0; color: #1a1a1a;">Upgrades Purchased</h3>
        <ul style="margin: 0; padding-left: 20px; color: #333;">
          {{productListHtml}}
        </ul>
      </div>
      <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 6px; text-align: center;">
        <p style="margin: 0; font-size: 14px;">Amount Paid</p>
        <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold;">{{formattedAmount}}</p>
      </div>
      <div style="text-align: center; margin-top: 30px;">
        <a href="{{appUrl}}/pr/{{releaseUuid}}/review" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Press Release</a>
      </div>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
        This receipt was sent from Newsworthy. If you have any questions, please contact us at support@newsworthyai.com.
      </p>
    </div>
  </body>
</html>`,
    textBody: `Payment Receipt - Newsworthy\n\nThank you for your purchase!\n\nDate: {{date}}\nTransaction ID: {{transactionId}}\nCustomer: {{customerName}}\n\nPress Release: {{releaseTitle}}\nRelease ID: {{releaseUuid}}\n\nUpgrades Purchased:\n{{productListText}}\n\nAmount Paid: {{formattedAmount}}\n\nView your press release: {{appUrl}}/pr/{{releaseUuid}}/review\n\nIf you have any questions, please contact us at support@newsworthyai.com.`,
  },
  {
    slug: 'approval-request',
    name: 'Approval Request',
    description: 'Sent when a user requests approval for a press release',
    subject: 'Approval Requested: {{releaseTitle}}',
    variables: '{{approverName}}, {{requestorName}}, {{releaseTitle}}, {{notesHtml}}, {{approvalLink}}',
    htmlBody: `<!DOCTYPE html>
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
      <p style="margin-bottom: 20px;">Hi {{approverName}},</p>
      <p style="margin-bottom: 20px;">
        <strong>{{requestorName}}</strong> has requested your approval for a press release before it is distributed.
      </p>
      <div style="background-color: #fff; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Press Release</h3>
        <p style="margin: 0; font-weight: 600; color: #333;">{{releaseTitle}}</p>
      </div>
      {{notesHtml}}
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{approvalLink}}" style="display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Press Release</a>
      </div>
      <p style="font-size: 14px; color: #666; margin-top: 20px;">
        Click the button above to review the press release and provide your feedback. You can approve or decline the release directly from the page.
      </p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999; text-align: center; margin: 0;">
        This email was sent from Newsworthy on behalf of {{requestorName}}. If you believe this was sent in error, you can safely ignore it.
      </p>
    </div>
  </body>
</html>`,
    textBody: `Your Approval is Requested\n\nHi {{approverName}},\n\n{{requestorName}} has requested your approval for a press release before it is distributed.\n\nPress Release: {{releaseTitle}}\n{{notesText}}\nClick the link below to review the press release and provide your feedback:\n{{approvalLink}}\n\nYou can approve or decline the release directly from the page.\n\nThis email was sent from Newsworthy on behalf of {{requestorName}}. If you believe this was sent in error, you can safely ignore it.`,
  },
  {
    slug: 'verification',
    name: 'Email Verification',
    description: 'Sent when a new user registers to verify their email address',
    subject: 'Verify your email - Newsworthy',
    variables: '{{name}}, {{verifyLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Verify your email - Newsworthy</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">Verify your email</h1>
      <p>Hi {{name}},</p>
      <p style="margin-bottom: 20px;">Thanks for signing up for Newsworthy! Please verify your email address by clicking the button below.</p>
      <a href="{{verifyLink}}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Verify Email</a>
      <p style="margin-top: 20px; font-size: 14px; color: #666;">If you didn't create an account, you can safely ignore this email.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">This link expires in 24 hours.</p>
    </div>
  </body>
</html>`,
    textBody: `Verify your email\n\nHi {{name}},\n\nThanks for signing up for Newsworthy! Please verify your email by clicking this link:\n\n{{verifyLink}}\n\nThis link expires in 24 hours.`,
  },
  {
    slug: 'team-invite',
    name: 'Team Invitation',
    description: 'Sent when a user is invited to join a team/brand',
    subject: "You've been invited to join {{companyName}} on Newsworthy",
    variables: '{{inviterName}}, {{companyName}}, {{roleLabel}}, {{inviteLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>You've been invited to join a team - Newsworthy</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">You've been invited to a team</h1>
      <p style="margin-bottom: 20px;">
        <strong>{{inviterName}}</strong> has invited you to join <strong>{{companyName}}</strong> on Newsworthy as a <strong>{{roleLabel}}</strong>.
      </p>
      <a href="{{inviteLink}}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Accept Invitation</a>
      <p style="margin-top: 20px; font-size: 14px; color: #666;">This invitation expires in 7 days. If you don't have an account, you'll be able to create one.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy on behalf of {{inviterName}}. If you believe this was sent in error, you can safely ignore it.</p>
    </div>
  </body>
</html>`,
    textBody: `You've been invited to a team\n\n{{inviterName}} has invited you to join {{companyName}} on Newsworthy as a {{roleLabel}}.\n\nAccept the invitation: {{inviteLink}}\n\nThis invitation expires in 7 days.`,
  },
  {
    slug: 'message-notification',
    name: 'Message Notification',
    description: 'Sent when a user receives a new message or reply',
    subject: '{{heading}} on Newsworthy',
    variables: '{{recipientName}}, {{heading}}, {{description}}, {{inboxLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>{{heading}} - Newsworthy</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">{{heading}}</h1>
      <p>Hi {{recipientName}},</p>
      <p style="margin-bottom: 20px;">{{description}}</p>
      <a href="{{inboxLink}}" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Inbox</a>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy. If you believe this was sent in error, you can safely ignore it.</p>
    </div>
  </body>
</html>`,
    textBody: `Hi {{recipientName}},\n\n{{description}}\n\nView your inbox: {{inboxLink}}`,
  },
  {
    slug: 'welcome',
    name: 'Welcome Email',
    description: 'Sent to new users after they verify their email',
    subject: 'Welcome to Newsworthy!',
    variables: '{{name}}, {{dashboardLink}}',
    htmlBody: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Welcome to Newsworthy</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
      <h1 style="color: #1a1a1a; margin-bottom: 20px;">Welcome to Newsworthy!</h1>
      <p>Hi {{name}},</p>
      <p style="margin-bottom: 20px;">Thanks for joining Newsworthy! We're excited to help you with your press release distribution needs.</p>
      <p style="margin-bottom: 20px;">Here's what you can do:</p>
      <ul style="margin-bottom: 20px;">
        <li>Create and distribute press releases</li>
        <li>Access our media database</li>
        <li>Connect with influencers</li>
        <li>Track your press coverage</li>
      </ul>
      <a href="{{dashboardLink}}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Go to Dashboard</a>
    </div>
  </body>
</html>`,
    textBody: `Welcome to Newsworthy!\n\nHi {{name}},\n\nThanks for joining Newsworthy! We're excited to help you with your press release distribution needs.`,
  },
]

async function seed() {
  console.log('Seeding email templates...')

  for (const tmpl of templates) {
    try {
      await db
        .insert(schema.emailTemplates)
        .values(tmpl)
        .onConflictDoNothing({ target: schema.emailTemplates.slug })

      console.log(`  ✓ ${tmpl.slug}`)
    } catch (err) {
      console.error(`  ✗ ${tmpl.slug}:`, err)
    }
  }

  console.log('Done!')
  await client.end()
}

seed()
