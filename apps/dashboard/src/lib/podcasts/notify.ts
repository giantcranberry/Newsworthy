import twilio from 'twilio'
import { sendEmail } from '@/lib/email'

// This module runs inside the standalone `doppler run -- bun scripts/refresh-podcast-feeds.ts`
// cron, NOT the Next.js app — so NEXT_PUBLIC_APP_URL is read live from process.env and is
// NOT build-time inlined the way it is in the dashboard's route handlers. If the cron's env
// resolves it to a localhost value (or it's absent), real user emails/SMS/Slack would link to
// localhost. Guard against that: a localhost/empty value falls back to the production domain.
function resolveAppUrl(): string {
  const candidate = (process.env.NEXT_PUBLIC_APP_URL || process.env.DASHBOARD_URL || '').trim()
  if (!candidate || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(candidate)) {
    return 'https://app.newsworthyai.com'
  }
  return candidate.replace(/\/+$/, '')
}

const APP_URL = resolveAppUrl()

interface NotifyInput {
  feed: {
    uuid: string
    title: string | null
    notifyEmail: boolean
    notifyEmailTo: string | null
    notifySms: boolean
    notifySmsPhone: string | null
    notifyInApp: boolean
    notifySlack: boolean
    notifySlackWebhookUrl: string | null
  }
  release: { uuid: string; title: string }
  episode: { title: string | null }
}

function buildReviewUrl(feedUuid: string): string {
  return `${APP_URL}/pr/podcast/${feedUuid}`
}

async function sendEmailNotification(input: NotifyInput) {
  if (!input.feed.notifyEmail || !input.feed.notifyEmailTo) return
  const reviewUrl = buildReviewUrl(input.feed.uuid)
  const showTitle = input.feed.title || 'Your podcast'
  const epTitle = input.episode.title || '(untitled episode)'

  const subject = `Draft press release ready: ${input.release.title.slice(0, 120)}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">A new draft press release is ready</h2>
      <p style="margin: 0 0 16px;">A press release draft has been generated for the latest episode of <strong>${escapeHtml(showTitle)}</strong>: <em>${escapeHtml(epTitle)}</em>.</p>
      <p style="margin: 0 0 24px;"><strong>${escapeHtml(input.release.title)}</strong></p>
      <p style="margin: 0 0 24px;">Log in to review, edit if needed, and submit it for editorial review.</p>
      <p style="margin: 0 0 24px;">
        <a href="${reviewUrl}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review & submit</a>
      </p>
      <p style="margin: 0; color: #666; font-size: 13px;">If the button doesn't work, copy this link: ${reviewUrl}</p>
    </div>
  `
  const text = `A press release draft is ready for ${showTitle} — "${epTitle}".\n\nTitle: ${input.release.title}\n\nReview & submit: ${reviewUrl}`

  try {
    await sendEmail({ to: input.feed.notifyEmailTo, subject, html, text })
  } catch (err) {
    console.error('[podcast-notify] email failed:', err)
  }
}

function sendSms(input: NotifyInput) {
  if (!input.feed.notifySms || !input.feed.notifySmsPhone) return
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_TOKEN
  const from = process.env.TWILIO_NUMBER
  if (!sid || !token || !from) {
    console.warn('[podcast-notify] Twilio env vars missing — skipping SMS')
    return
  }
  const reviewUrl = buildReviewUrl(input.feed.uuid)
  const body = `New press release draft ready: "${input.release.title.slice(0, 90)}". Review & submit: ${reviewUrl}`
  const raw = input.feed.notifySmsPhone.trim()
  const to = raw.startsWith('+') ? raw : `+1${raw.replace(/\D/g, '')}`

  try {
    twilio(sid, token)
      .messages.create({ body, from, to })
      .catch((err) => console.error('[podcast-notify] SMS failed:', err.message))
  } catch (err) {
    console.error('[podcast-notify] SMS dispatch crashed:', err)
  }
}

async function sendSlack(input: NotifyInput) {
  if (!input.feed.notifySlack || !input.feed.notifySlackWebhookUrl) return
  const reviewUrl = buildReviewUrl(input.feed.uuid)
  const showTitle = input.feed.title || 'Your podcast'
  const epTitle = input.episode.title || '(untitled episode)'

  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*New press release draft ready* for *${showTitle}* — _${epTitle}_\n\n*${input.release.title}*`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Review & submit' },
            url: reviewUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }

  try {
    const res = await fetch(input.feed.notifySlackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('[podcast-notify] Slack webhook failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[podcast-notify] Slack crashed:', err)
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}

/**
 * Fan out new-draft notifications to whatever channels the feed has enabled.
 * Best-effort: failures in one channel never throw, so PR generation keeps
 * succeeding even if SMTP/Twilio/Slack are misconfigured.
 */
export async function dispatchNewDraftNotifications(input: NotifyInput): Promise<void> {
  await Promise.all([
    sendEmailNotification(input),
    Promise.resolve(sendSms(input)),
    sendSlack(input),
  ])
}

interface FundingNotifyInput {
  feed: {
    uuid: string
    title: string | null
    notifyEmail: boolean
    notifyEmailTo: string | null
    notifySms: boolean
    notifySmsPhone: string | null
    notifySlack: boolean
    notifySlackWebhookUrl: string | null
  }
  credits: number
  pendingDrafts: number
}

function buildFundingUrl(feedUuid: string): string {
  return `${APP_URL}/pr/podcast/${feedUuid}?tab=funding`
}

async function sendFundingEmail(input: FundingNotifyInput) {
  if (!input.feed.notifyEmail || !input.feed.notifyEmailTo) return
  const fundingUrl = buildFundingUrl(input.feed.uuid)
  const showTitle = input.feed.title || 'Your podcast'

  const subject = `Action needed: add Podcast PR credits for ${showTitle.slice(0, 80)}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">Your Podcast PR account needs funding</h2>
      <p style="margin: 0 0 16px;">We've paused generating new press release drafts for <strong>${escapeHtml(showTitle)}</strong> because the credit balance is fully reserved by drafts that haven't been submitted yet.</p>
      <p style="margin: 0 0 16px;">Current credits: <strong>${input.credits}</strong>. Drafts awaiting submit: <strong>${input.pendingDrafts}</strong>. We resume new drafts as soon as credits exceed the pending count.</p>
      <p style="margin: 0 0 24px;">
        <a href="${fundingUrl}" style="display: inline-block; background: #0891b2; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Add credits</a>
      </p>
      <p style="margin: 0; color: #666; font-size: 13px;">If the button doesn't work, copy this link: ${fundingUrl}</p>
    </div>
  `
  const text = `Your Podcast PR account needs funding.\n\n${showTitle}: credits=${input.credits}, drafts awaiting submit=${input.pendingDrafts}. We won't generate new drafts until credits exceed the pending count.\n\nAdd credits: ${fundingUrl}`

  try {
    await sendEmail({ to: input.feed.notifyEmailTo, subject, html, text })
  } catch (err) {
    console.error('[podcast-notify] funding email failed:', err)
  }
}

function sendFundingSms(input: FundingNotifyInput) {
  if (!input.feed.notifySms || !input.feed.notifySmsPhone) return
  const sid = process.env.TWILIO_SID
  const token = process.env.TWILIO_TOKEN
  const from = process.env.TWILIO_NUMBER
  if (!sid || !token || !from) {
    console.warn('[podcast-notify] Twilio env vars missing — skipping funding SMS')
    return
  }
  const fundingUrl = buildFundingUrl(input.feed.uuid)
  const showTitle = input.feed.title || 'Your podcast'
  const body = `Podcast PR account needs funding. ${showTitle.slice(0, 60)}: ${input.credits} credits, ${input.pendingDrafts} drafts waiting. Add credits: ${fundingUrl}`
  const raw = input.feed.notifySmsPhone.trim()
  const to = raw.startsWith('+') ? raw : `+1${raw.replace(/\D/g, '')}`

  try {
    twilio(sid, token)
      .messages.create({ body, from, to })
      .catch((err) => console.error('[podcast-notify] funding SMS failed:', err.message))
  } catch (err) {
    console.error('[podcast-notify] funding SMS dispatch crashed:', err)
  }
}

async function sendFundingSlack(input: FundingNotifyInput) {
  if (!input.feed.notifySlack || !input.feed.notifySlackWebhookUrl) return
  const fundingUrl = buildFundingUrl(input.feed.uuid)
  const showTitle = input.feed.title || 'Your podcast'

  const payload = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Podcast PR account needs funding* for *${showTitle}*\n\nCredits: *${input.credits}*. Drafts awaiting submit: *${input.pendingDrafts}*. New drafts paused until credits exceed pending drafts.`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Add credits' },
            url: fundingUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }

  try {
    const res = await fetch(input.feed.notifySlackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error('[podcast-notify] funding Slack webhook failed:', res.status, await res.text().catch(() => ''))
    }
  } catch (err) {
    console.error('[podcast-notify] funding Slack crashed:', err)
  }
}

/**
 * Notify the feed owner that the brand's Podcast PR credits are insufficient
 * to cover existing drafts, so new draft generation is paused. Best-effort
 * fan-out across whatever channels the feed has enabled. Caller is
 * responsible for the cooldown (podcast_feeds.funding_warning_sent_at).
 */
export async function dispatchFundingNeededNotification(input: FundingNotifyInput): Promise<void> {
  await Promise.all([
    sendFundingEmail(input),
    Promise.resolve(sendFundingSms(input)),
    sendFundingSlack(input),
  ])
}
