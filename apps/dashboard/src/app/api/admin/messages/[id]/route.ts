import { auth } from '@/lib/auth'
import { db } from '@/db'
import { globalMessages, globalMessageReads, userMessages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PUT: Edit global message or unread sent message
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const messageId = parseInt(id)
  if (isNaN(messageId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const body = await request.json()
  const { type } = body

  if (type === 'sent') {
    // Edit a sent user message — only if unread
    const { subject, body: messageBody } = body

    if (!subject?.trim() || !messageBody?.trim()) {
      return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
    }

    // Check it exists and is unread
    const [existing] = await db
      .select({ isRead: userMessages.isRead })
      .from(userMessages)
      .where(eq(userMessages.id, messageId))

    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (existing.isRead) {
      return NextResponse.json({ error: 'Cannot edit a message that has already been read' }, { status: 400 })
    }

    const [updated] = await db
      .update(userMessages)
      .set({ subject: subject.trim(), body: messageBody })
      .where(eq(userMessages.id, messageId))
      .returning()

    return NextResponse.json(updated)
  }

  // Default: edit global message
  const { subject, body: messageBody, expiresAt, isActive } = body

  const updates: Record<string, any> = {}
  if (subject !== undefined) updates.subject = subject.trim()
  if (messageBody !== undefined) updates.body = messageBody
  if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null
  if (isActive !== undefined) updates.isActive = isActive

  const [updated] = await db
    .update(globalMessages)
    .set(updates)
    .where(eq(globalMessages.id, messageId))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// DELETE: Delete a message
// ?type=global (default) — delete global message and its reads
// ?type=sent — delete a sent user message
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const messageId = parseInt(id)
  if (isNaN(messageId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const type = request.nextUrl.searchParams.get('type') || 'global'

  if (type === 'sent') {
    const deleted = await db
      .delete(userMessages)
      .where(eq(userMessages.id, messageId))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
  } else {
    // Delete reads first (cascade should handle it, but be explicit)
    await db
      .delete(globalMessageReads)
      .where(eq(globalMessageReads.globalMessageId, messageId))

    const deleted = await db
      .delete(globalMessages)
      .where(eq(globalMessages.id, messageId))
      .returning()

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }
  }

  return NextResponse.json({ success: true })
}
