import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { chatConversations, chatParticipants } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [conv] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.uuid, uuid))
    .limit(1)

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  await db
    .update(chatParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(chatParticipants.conversationId, conv.id),
        eq(chatParticipants.userId, userId)
      )
    )

  return NextResponse.json({ success: true })
}
