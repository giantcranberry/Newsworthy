import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { globalMessages, globalMessageReads, userMessages, users, userProfiles } from '@/db/schema'
import { eq, and, sql, desc, or, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: Inbox — merged global + personal messages
export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const type = request.nextUrl.searchParams.get('type') || 'all'
  const nowISO = new Date().toISOString()

  // Fetch active, non-expired global messages with read status
  const globalRows = await db
    .select({
      id: globalMessages.id,
      subject: globalMessages.subject,
      body: globalMessages.body,
      createdAt: globalMessages.createdAt,
      readAt: globalMessageReads.readAt,
      isArchived: globalMessageReads.isArchived,
      isDeleted: globalMessageReads.isDeleted,
    })
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
        )
      )
    )
    .orderBy(desc(globalMessages.createdAt))

  // Fetch personal messages
  const personalRows = await db
    .select({
      id: userMessages.id,
      subject: userMessages.subject,
      body: userMessages.body,
      createdAt: userMessages.createdAt,
      isRead: userMessages.isRead,
      readAt: userMessages.readAt,
      isArchived: userMessages.isArchived,
      isDeleted: userMessages.isDeleted,
      fromId: userMessages.fromId,
      taskId: userMessages.taskId,
      senderEmail: users.email,
      senderFirstName: userProfiles.firstName,
      senderLastName: userProfiles.lastName,
    })
    .from(userMessages)
    .leftJoin(users, eq(userMessages.fromId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(userMessages.toId, userId))
    .orderBy(desc(userMessages.createdAt))

  // Merge and normalize
  type InboxMessage = {
    id: number
    type: 'global' | 'user'
    subject: string
    body: string
    createdAt: Date | null
    isRead: boolean
    isArchived: boolean
    isDeleted: boolean
    senderName: string
    fromId: number | null
    taskId: number | null
  }

  const messages: InboxMessage[] = []

  for (const row of globalRows) {
    const isDeleted = row.isDeleted ?? false
    const isArchived = row.isArchived ?? false
    const isRead = row.readAt !== null

    if (isDeleted) continue

    messages.push({
      id: row.id,
      type: 'global',
      subject: row.subject,
      body: row.body,
      createdAt: row.createdAt,
      isRead,
      isArchived,
      isDeleted: false,
      senderName: 'Newsworthy',
      fromId: null,
      taskId: null,
    })
  }

  for (const row of personalRows) {
    if (row.isDeleted) continue

    const senderName = row.fromId === null
      ? 'Newsworthy'
      : row.senderFirstName
        ? `${row.senderFirstName} ${row.senderLastName || ''}`.trim()
        : row.senderEmail || 'Unknown'

    messages.push({
      id: row.id,
      type: 'user',
      subject: row.subject,
      body: row.body,
      createdAt: row.createdAt,
      isRead: row.isRead,
      isArchived: row.isArchived,
      isDeleted: false,
      senderName,
      fromId: row.fromId,
      taskId: row.taskId,
    })
  }

  // Sort by createdAt desc
  messages.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
    return bTime - aTime
  })

  // Filter by type
  let filtered = messages
  if (type === 'unread') {
    filtered = messages.filter(m => !m.isRead && !m.isArchived)
  } else if (type === 'archived') {
    filtered = messages.filter(m => m.isArchived)
  } else {
    filtered = messages.filter(m => !m.isArchived)
  }

  return NextResponse.json(filtered)
}
