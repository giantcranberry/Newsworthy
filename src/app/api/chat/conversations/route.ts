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
import { and, desc, eq, gt, sql, ne } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get conversations the user is part of
  const myParticipations = await db
    .select({
      conversationId: chatParticipants.conversationId,
      lastReadAt: chatParticipants.lastReadAt,
      isMuted: chatParticipants.isMuted,
    })
    .from(chatParticipants)
    .where(eq(chatParticipants.userId, userId))

  if (myParticipations.length === 0) {
    return NextResponse.json([])
  }

  const convIds = myParticipations.map((p) => p.conversationId)
  const lastReadMap = new Map(myParticipations.map((p) => [p.conversationId, p.lastReadAt]))

  // Get conversations with other participant info and last message
  const conversations = []
  for (const convId of convIds) {
    // Get other participant
    const [otherParticipant] = await db
      .select({
        userId: chatParticipants.userId,
        name: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('name'),
        avatar: userProfiles.avatar,
        acctHandle: userProfiles.acctHandle,
      })
      .from(chatParticipants)
      .innerJoin(users, eq(chatParticipants.userId, users.id))
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(
        and(
          eq(chatParticipants.conversationId, convId),
          ne(chatParticipants.userId, userId)
        )
      )
      .limit(1)

    // Get last message
    const [lastMessage] = await db
      .select({
        body: chatMessages.body,
        userId: chatMessages.userId,
        createdAt: chatMessages.createdAt,
        isDeleted: chatMessages.isDeleted,
      })
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, convId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(1)

    // Get conversation UUID
    const [conv] = await db
      .select({ uuid: chatConversations.uuid, updatedAt: chatConversations.updatedAt })
      .from(chatConversations)
      .where(eq(chatConversations.id, convId))
      .limit(1)

    // Count unread
    const lastRead = lastReadMap.get(convId)
    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, convId),
          ne(chatMessages.userId, userId),
          eq(chatMessages.isDeleted, false),
          lastRead ? gt(chatMessages.createdAt, lastRead) : sql`TRUE`
        )
      )

    if (otherParticipant && conv) {
      conversations.push({
        uuid: conv.uuid,
        conversationId: convId,
        otherUser: otherParticipant,
        lastMessage: lastMessage
          ? {
              body: lastMessage.isDeleted ? '[deleted]' : lastMessage.body,
              isOwn: lastMessage.userId === userId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount: Number(unreadResult?.count || 0),
        updatedAt: conv.updatedAt,
      })
    }
  }

  // Sort by last activity
  conversations.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt || a.updatedAt
    const bTime = b.lastMessage?.createdAt || b.updatedAt
    return new Date(bTime!).getTime() - new Date(aTime!).getTime()
  })

  return NextResponse.json(conversations)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const currentUserId = (session?.user as any)?.id
  if (!currentUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId: otherUserId } = await request.json()
  if (!otherUserId || otherUserId === currentUserId) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  // Check if conversation already exists between these two users
  const myConvs = await db
    .select({ conversationId: chatParticipants.conversationId })
    .from(chatParticipants)
    .where(eq(chatParticipants.userId, currentUserId))

  for (const mc of myConvs) {
    const [otherPart] = await db
      .select({ userId: chatParticipants.userId })
      .from(chatParticipants)
      .where(
        and(
          eq(chatParticipants.conversationId, mc.conversationId),
          eq(chatParticipants.userId, otherUserId)
        )
      )
      .limit(1)

    if (otherPart) {
      // Conversation already exists
      const [conv] = await db
        .select()
        .from(chatConversations)
        .where(eq(chatConversations.id, mc.conversationId))
        .limit(1)
      return NextResponse.json({ uuid: conv.uuid, existing: true })
    }
  }

  // Create new conversation
  const [conv] = await db
    .insert(chatConversations)
    .values({ uuid: randomUUID() })
    .returning()

  await db.insert(chatParticipants).values([
    { conversationId: conv.id, userId: currentUserId },
    { conversationId: conv.id, userId: otherUserId },
  ])

  return NextResponse.json({ uuid: conv.uuid, existing: false }, { status: 201 })
}
