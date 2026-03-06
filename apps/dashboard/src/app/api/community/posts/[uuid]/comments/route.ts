import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityComments, communityPosts, users, userProfiles } from '@/db/schema'
import { and, asc, eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const comments = await db
    .select({
      id: communityComments.id,
      uuid: communityComments.uuid,
      postId: communityComments.postId,
      parentId: communityComments.parentId,
      depth: communityComments.depth,
      userId: communityComments.userId,
      userName: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('userName'),
      userAvatar: userProfiles.avatar,
      userEmailHash: sql<string>`MD5(LOWER(TRIM(${users.email})))`.as('userEmailHash'),
      userHandle: userProfiles.acctHandle,
      body: communityComments.body,
      isDeleted: communityComments.isDeleted,
      reactionCount: communityComments.reactionCount,
      createdAt: communityComments.createdAt,
    })
    .from(communityComments)
    .innerJoin(users, eq(communityComments.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(communityComments.postId, post.id))
    .orderBy(asc(communityComments.createdAt))

  return NextResponse.json(comments)
}

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
  const { body, parentId } = await request.json()

  if (!body?.trim()) {
    return NextResponse.json({ error: 'Comment body required' }, { status: 400 })
  }

  const [post] = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(and(eq(communityPosts.uuid, uuid), eq(communityPosts.isDeleted, false)))
    .limit(1)

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  let depth = 0
  if (parentId) {
    const [parent] = await db
      .select({ depth: communityComments.depth })
      .from(communityComments)
      .where(eq(communityComments.id, parentId))
      .limit(1)
    if (parent) {
      depth = parent.depth + 1
    }
  }

  const [comment] = await db
    .insert(communityComments)
    .values({
      uuid: randomUUID(),
      postId: post.id,
      userId,
      parentId: parentId || null,
      depth,
      body: body.trim(),
    })
    .returning()

  // Update denormalized count
  await db
    .update(communityPosts)
    .set({
      commentCount: sql`${communityPosts.commentCount} + 1`,
    })
    .where(eq(communityPosts.id, post.id))

  return NextResponse.json(comment, { status: 201 })
}
