import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { chatParticipants, chatMessages } from '@/db/schema'
import { and, eq, gt, ne, sql } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get all conversations the user is part of
  const participations = await db
    .select({
      conversationId: chatParticipants.conversationId,
      lastReadAt: chatParticipants.lastReadAt,
    })
    .from(chatParticipants)
    .where(eq(chatParticipants.userId, userId))

  let totalUnread = 0

  for (const p of participations) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.conversationId, p.conversationId),
          ne(chatMessages.userId, userId),
          eq(chatMessages.isDeleted, false),
          p.lastReadAt ? gt(chatMessages.createdAt, p.lastReadAt) : sql`TRUE`
        )
      )

    totalUnread += Number(result?.count || 0)
  }

  return NextResponse.json({ count: totalUnread })
}
