import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { globalMessageReads, userMessages } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PATCH: Bulk action on multiple messages
export async function PATCH(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const body = await request.json()
  const { action, messages } = body as {
    action: 'read' | 'archive' | 'delete'
    messages: { id: number; type: 'global' | 'user' }[]
  }

  if (!action || !messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Action and messages are required' }, { status: 400 })
  }

  const globalIds = messages.filter(m => m.type === 'global').map(m => m.id)
  const userIds = messages.filter(m => m.type === 'user').map(m => m.id)

  // Process global messages
  if (globalIds.length > 0) {
    const updates: Record<string, any> = {}
    if (action === 'read') updates.readAt = new Date()
    if (action === 'archive') {
      updates.isArchived = true
      updates.readAt = new Date()
    }
    if (action === 'delete') {
      updates.isDeleted = true
      updates.readAt = new Date()
    }

    for (const gId of globalIds) {
      await db
        .insert(globalMessageReads)
        .values({
          globalMessageId: gId,
          userId,
          ...updates,
        })
        .onConflictDoUpdate({
          target: [globalMessageReads.globalMessageId, globalMessageReads.userId],
          set: updates,
        })
    }
  }

  // Process user messages
  if (userIds.length > 0) {
    const updates: Record<string, any> = {}
    if (action === 'read') {
      updates.isRead = true
      updates.readAt = new Date()
    }
    if (action === 'archive') {
      updates.isArchived = true
      updates.isRead = true
      updates.readAt = new Date()
    }
    if (action === 'delete') {
      updates.isDeleted = true
      updates.isRead = true
      updates.readAt = new Date()
    }

    await db
      .update(userMessages)
      .set(updates)
      .where(and(
        inArray(userMessages.id, userIds),
        eq(userMessages.toId, userId)
      ))
  }

  return NextResponse.json({ success: true })
}
