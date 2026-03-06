import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { chatConversations, chatParticipants, chatMessages } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params
  const { body } = await request.json()

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Message body required' }, { status: 400 })
  }

  // Find conversation
  const [conv] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.uuid, uuid))
    .limit(1)

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Verify user is a participant
  const [participant] = await db
    .select()
    .from(chatParticipants)
    .where(
      and(
        eq(chatParticipants.conversationId, conv.id),
        eq(chatParticipants.userId, userId)
      )
    )
    .limit(1)

  if (!participant) {
    return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
  }

  const [message] = await db
    .insert(chatMessages)
    .values({
      uuid: randomUUID(),
      conversationId: conv.id,
      userId,
      body: body.trim(),
    })
    .returning()

  // Update conversation timestamp
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, conv.id))

  // Update sender's lastReadAt
  await db
    .update(chatParticipants)
    .set({ lastReadAt: new Date() })
    .where(eq(chatParticipants.id, participant.id))

  return NextResponse.json(message, { status: 201 })
}
