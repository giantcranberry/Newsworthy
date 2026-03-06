import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityReactions, communityPosts, communityComments } from '@/db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetType, targetId, emoji } = await request.json()

  if (!targetType || !targetId || !['post', 'comment'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid reaction target' }, { status: 400 })
  }

  const validEmoji = emoji || 'like'

  // Check if reaction already exists — if so, remove it (toggle)
  const [existing] = await db
    .select({ id: communityReactions.id })
    .from(communityReactions)
    .where(
      and(
        eq(communityReactions.userId, userId),
        eq(communityReactions.targetType, targetType),
        eq(communityReactions.targetId, targetId),
        eq(communityReactions.emoji, validEmoji)
      )
    )
    .limit(1)

  if (existing) {
    // Remove reaction
    await db.delete(communityReactions).where(eq(communityReactions.id, existing.id))

    // Decrement count
    if (targetType === 'post') {
      await db
        .update(communityPosts)
        .set({ reactionCount: sql`GREATEST(${communityPosts.reactionCount} - 1, 0)` })
        .where(eq(communityPosts.id, targetId))
    } else {
      await db
        .update(communityComments)
        .set({ reactionCount: sql`GREATEST(${communityComments.reactionCount} - 1, 0)` })
        .where(eq(communityComments.id, targetId))
    }

    return NextResponse.json({ reacted: false, emoji: validEmoji })
  }

  // Add reaction
  await db.insert(communityReactions).values({
    userId,
    targetType,
    targetId,
    emoji: validEmoji,
  })

  // Increment count
  if (targetType === 'post') {
    await db
      .update(communityPosts)
      .set({ reactionCount: sql`${communityPosts.reactionCount} + 1` })
      .where(eq(communityPosts.id, targetId))
  } else {
    await db
      .update(communityComments)
      .set({ reactionCount: sql`${communityComments.reactionCount} + 1` })
      .where(eq(communityComments.id, targetId))
  }

  return NextResponse.json({ reacted: true, emoji: validEmoji })
}

export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetType = searchParams.get('targetType')
  const targetIdsParam = searchParams.get('targetIds')

  if (!targetType || !targetIdsParam) {
    return NextResponse.json({ error: 'targetType and targetIds required' }, { status: 400 })
  }

  const targetIds = targetIdsParam.split(',').map(Number).filter(Boolean)
  if (targetIds.length === 0) {
    return NextResponse.json([])
  }

  const reactions = await db
    .select()
    .from(communityReactions)
    .where(
      and(
        eq(communityReactions.userId, userId),
        eq(communityReactions.targetType, targetType),
        inArray(communityReactions.targetId, targetIds)
      )
    )

  return NextResponse.json(reactions)
}
