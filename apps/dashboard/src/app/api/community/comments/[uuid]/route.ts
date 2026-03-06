import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityComments, communityPosts } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function PATCH(
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

  const [existing] = await db
    .select({ id: communityComments.id, userId: communityComments.userId })
    .from(communityComments)
    .where(eq(communityComments.uuid, uuid))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (existing.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [updated] = await db
    .update(communityComments)
    .set({ body, updatedAt: new Date() })
    .where(eq(communityComments.id, existing.id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [existing] = await db
    .select({
      id: communityComments.id,
      userId: communityComments.userId,
      postId: communityComments.postId,
    })
    .from(communityComments)
    .where(eq(communityComments.uuid, uuid))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (existing.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db
    .update(communityComments)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(communityComments.id, existing.id))

  // Decrement denormalized count
  await db
    .update(communityPosts)
    .set({
      commentCount: sql`GREATEST(${communityPosts.commentCount} - 1, 0)`,
    })
    .where(eq(communityPosts.id, existing.postId))

  return NextResponse.json({ success: true })
}
