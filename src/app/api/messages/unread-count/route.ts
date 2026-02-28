import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { globalMessages, globalMessageReads, userMessages } from '@/db/schema'
import { eq, and, sql, or, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// GET: Lightweight unread count for bell badge
export async function GET() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 })
  }

  const userId = parseInt(session.user.id)
  const nowISO = new Date().toISOString()

  // Count unread global messages (active, not expired, not read, not deleted, not archived)
  const [globalCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(globalMessages)
    .leftJoin(
      globalMessageReads,
      and(
        eq(globalMessageReads.globalMessageId, globalMessages.id),
        eq(globalMessageReads.userId, userId)
      )
    )
    .where(
      and(
        eq(globalMessages.isActive, true),
        or(
          isNull(globalMessages.expiresAt),
          sql`${globalMessages.expiresAt} > ${nowISO}::timestamp`
        ),
        or(
          isNull(globalMessageReads.id),
          and(
            isNull(globalMessageReads.readAt),
            eq(globalMessageReads.isDeleted, false),
            eq(globalMessageReads.isArchived, false)
          )
        )
      )
    )

  // Count unread personal messages
  const [personalCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(userMessages)
    .where(
      and(
        eq(userMessages.toId, userId),
        eq(userMessages.isRead, false),
        eq(userMessages.isDeleted, false),
        eq(userMessages.isArchived, false)
      )
    )

  const count = Number(globalCount.count) + Number(personalCount.count)

  return NextResponse.json({ count })
}
