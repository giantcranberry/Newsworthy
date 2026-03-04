import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  chatConversations,
  chatParticipants,
  chatMessages,
  users,
  userProfiles,
} from '@/db/schema'
import { and, desc, eq, lt, sql } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params
  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

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

  // Fetch messages
  const conditions = [eq(chatMessages.conversationId, conv.id)]
  if (before) {
    conditions.push(lt(chatMessages.createdAt, new Date(before)))
  }

  const messages = await db
    .select({
      id: chatMessages.id,
      uuid: chatMessages.uuid,
      userId: chatMessages.userId,
      userName: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('userName'),
      userAvatar: userProfiles.avatar,
      body: chatMessages.body,
      isDeleted: chatMessages.isDeleted,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .innerJoin(users, eq(chatMessages.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(and(...conditions))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit)

  // Return in chronological order
  return NextResponse.json(messages.reverse())
}
