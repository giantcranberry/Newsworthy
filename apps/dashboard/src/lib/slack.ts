import { db } from '@/db'
import { slackConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!

/**
 * Generate the Slack OAuth URL for "Add to Slack" flow.
 * State is base64-encoded userId so we can link the connection on callback.
 */
export function getSlackAuthUrl(state: string): string {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`
  const scopes = 'incoming-webhook'
  return `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`
}

/**
 * Exchange a Slack OAuth code for access token + webhook details.
 */
export async function exchangeSlackCode(code: string) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/slack/callback`

  const resp = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID,
      client_secret: SLACK_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  })

  const data = await resp.json()
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`)
  }

  return {
    teamId: data.team?.id as string,
    teamName: data.team?.name as string | undefined,
    channelId: data.incoming_webhook?.channel_id as string,
    channelName: data.incoming_webhook?.channel as string | undefined,
    webhookUrl: data.incoming_webhook?.url as string,
    botToken: data.access_token as string | undefined,
  }
}

/**
 * Check if a user has a Slack connection.
 */
export async function isSlackConnected(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: slackConnections.id })
    .from(slackConnections)
    .where(eq(slackConnections.userId, userId))
    .limit(1)

  return !!row
}

/**
 * Get full Slack connection details for a user, or null.
 */
export async function getSlackConnection(userId: number) {
  const [row] = await db
    .select()
    .from(slackConnections)
    .where(eq(slackConnections.userId, userId))
    .limit(1)

  return row || null
}

/**
 * Remove a user's Slack connection.
 */
export async function disconnectSlack(userId: number): Promise<void> {
  await db
    .delete(slackConnections)
    .where(eq(slackConnections.userId, userId))
}

/**
 * Send a Slack notification to a user via their stored incoming webhook.
 * Best-effort: logs errors but never throws.
 */
export async function sendSlackNotification(
  userId: number,
  message: { text: string; blocks?: any[] }
): Promise<void> {
  try {
    const connection = await getSlackConnection(userId)
    if (!connection) return

    const payload: Record<string, unknown> = { text: message.text }
    if (message.blocks) {
      payload.blocks = message.blocks
    }

    const resp = await fetch(connection.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      console.error(`[Slack] Webhook failed for user ${userId}: ${resp.status} ${resp.statusText}`)
    }
  } catch (err) {
    console.error(`[Slack] Failed to send notification to user ${userId}:`, err)
  }
}

// ── Message Formatters ──────────────────────────────────────────────

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthyai.com'

export function formatPrStatusMessage(title: string, status: string, notes?: string) {
  const statusEmoji: Record<string, string> = {
    approved: ':white_check_mark:',
    'on hold': ':pause_button:',
    'needs revision': ':pencil2:',
  }
  const emoji = statusEmoji[status] || ':bell:'

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} *Press Release ${status.charAt(0).toUpperCase() + status.slice(1)}*\n<${appUrl}/pr|${title}>`,
      },
    },
  ]

  if (notes) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> ${notes}`,
      },
    })
  }

  return {
    text: `Press Release ${status}: ${title}`,
    blocks,
  }
}

export function formatNewMessageAlert(subject: string, senderName: string) {
  return {
    text: `New message from ${senderName}: ${subject}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:envelope: *New Message* from *${senderName}*\n${subject}\n<${appUrl}/messages|View Messages>`,
        },
      },
    ],
  }
}

export function formatTaskAssignmentMessage(taskTitle: string, assignerName: string) {
  return {
    text: `Task assigned by ${assignerName}: ${taskTitle}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:clipboard: *Task Assigned* by *${assignerName}*\n${taskTitle}\n<${appUrl}/admin/tasks|View Task Board>`,
        },
      },
    ],
  }
}

export function formatTaskStatusChangeMessage(taskTitle: string, newStageName: string, changedByName: string) {
  return {
    text: `Task moved to ${newStageName} by ${changedByName}: ${taskTitle}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:clipboard: *Task Status Changed* by *${changedByName}*\nMoved to *${newStageName}*: ${taskTitle}\n<${appUrl}/admin/tasks|View Task Board>`,
        },
      },
    ],
  }
}

export function formatTaskNoteAddedMessage(taskTitle: string, noteAuthorName: string) {
  return {
    text: `New note added by ${noteAuthorName} on: ${taskTitle}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:speech_balloon: *Note Added* by *${noteAuthorName}*\n${taskTitle}\n<${appUrl}/admin/tasks|View Task Board>`,
        },
      },
    ],
  }
}
