import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { globalMessageReads, userMessages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PATCH: Mark read/archive/delete a message
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const { id } = await params
  const messageId = parseInt(id)

  if (isNaN(messageId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const body = await request.json()
  const { action, type } = body as { action: 'read' | 'archive' | 'delete'; type: 'global' | 'user' }

  if (!action || !type) {
    return NextResponse.json({ error: 'Action and type are required' }, { status: 400 })
  }

  if (type === 'global') {
    // Upsert into global_message_reads
    const updates: Record<string, any> = {}
    if (action === 'read') updates.readAt = new Date()
    if (action === 'archive') {
      updates.isArchived = true
      if (!updates.readAt) updates.readAt = new Date()
    }
    if (action === 'delete') {
      updates.isDeleted = true
      if (!updates.readAt) updates.readAt = new Date()
    }

    await db
      .insert(globalMessageReads)
      .values({
        globalMessageId: messageId,
        userId,
        ...updates,
      })
      .onConflictDoUpdate({
        target: [globalMessageReads.globalMessageId, globalMessageReads.userId],
        set: updates,
      })
  } else if (type === 'user') {
    // Verify ownership
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

    const result = await db
      .update(userMessages)
      .set(updates)
      .where(and(eq(userMessages.id, messageId), eq(userMessages.toId, userId)))
      .returning()

    if (result.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
  } else {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
