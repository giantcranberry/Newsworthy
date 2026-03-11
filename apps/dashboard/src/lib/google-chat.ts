import { db } from '@/db'
import { googleChatConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Get full Google Chat connection details for a user, or null.
 */
export async function getGoogleChatConnection(userId: number) {
  const [row] = await db
    .select()
    .from(googleChatConnections)
    .where(eq(googleChatConnections.userId, userId))
    .limit(1)

  return row || null
}

/**
 * Check if a user has a Google Chat connection.
 */
export async function isGoogleChatConnected(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: googleChatConnections.id })
    .from(googleChatConnections)
    .where(eq(googleChatConnections.userId, userId))
    .limit(1)

  return !!row
}

/**
 * Remove a user's Google Chat connection.
 */
export async function disconnectGoogleChat(userId: number): Promise<void> {
  await db
    .delete(googleChatConnections)
    .where(eq(googleChatConnections.userId, userId))
}

/**
 * Send a Google Chat notification to a user via their stored webhook URL.
 * Best-effort: logs errors but never throws.
 */
export async function sendGoogleChatNotification(
  userId: number,
  message: { text: string }
): Promise<void> {
  try {
    const connection = await getGoogleChatConnection(userId)
    if (!connection) return

    const resp = await fetch(connection.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: message.text }),
    })

    if (!resp.ok) {
      console.error(`[GChat] Webhook failed for user ${userId}: ${resp.status} ${resp.statusText}`)
    }
  } catch (err) {
    console.error(`[GChat] Failed to send notification to user ${userId}:`, err)
  }
}

// ── Message Formatters ──────────────────────────────────────────────

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'

export function formatGChatPrStatusMessage(title: string, status: string, notes?: string) {
  const statusEmoji: Record<string, string> = {
    approved: '\u2705',
    'on hold': '\u23F8\uFE0F',
    'needs revision': '\u270F\uFE0F',
  }
  const emoji = statusEmoji[status] || '\uD83D\uDD14'
  const label = status.charAt(0).toUpperCase() + status.slice(1)

  let text = `${emoji} *Press Release ${label}*\n${title}\n${appUrl}/pr`
  if (notes) {
    text += `\n> ${notes}`
  }

  return { text }
}

export function formatGChatNewMessageAlert(subject: string, senderName: string) {
  return {
    text: `\u2709\uFE0F *New Message* from *${senderName}*\n${subject}\n${appUrl}/messages`,
  }
}

export function formatGChatTaskAssignmentMessage(taskTitle: string, assignerName: string) {
  return {
    text: `\uD83D\uDCCB *Task Assigned* by *${assignerName}*\n${taskTitle}\n${appUrl}/admin/tasks`,
  }
}

export function formatGChatTaskStatusChangeMessage(taskTitle: string, newStageName: string, changedByName: string) {
  return {
    text: `\uD83D\uDCCB *Task Status Changed* by *${changedByName}*\nMoved to *${newStageName}*: ${taskTitle}\n${appUrl}/admin/tasks`,
  }
}

export function formatGChatTaskNoteAddedMessage(taskTitle: string, noteAuthorName: string) {
  return {
    text: `\uD83D\uDCAC *Note Added* by *${noteAuthorName}*\n${taskTitle}\n${appUrl}/admin/tasks`,
  }
}
