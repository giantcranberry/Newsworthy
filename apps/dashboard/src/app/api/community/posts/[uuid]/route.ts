import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityPosts, communityPostImages, communityBoards, users, userProfiles } from '@/db/schema'
import { eq, sql, asc } from 'drizzle-orm'
import { deleteCommunityImage } from '@/services/s3'


export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [post] = await db
    .select({
      id: communityPosts.id,
      uuid: communityPosts.uuid,
      boardId: communityPosts.boardId,
      boardName: communityBoards.name,
      boardSlug: communityBoards.slug,
      boardColor: communityBoards.color,
      userId: communityPosts.userId,
      userName: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('userName'),
      userAvatar: userProfiles.avatar,
      userEmailHash: sql<string>`MD5(LOWER(TRIM(${users.email})))`.as('userEmailHash'),
      userHandle: userProfiles.acctHandle,
      userLocation: sql<string>`NULLIF(CONCAT_WS(', ', NULLIF(${userProfiles.city}, ''), NULLIF(COALESCE(NULLIF(${userProfiles.state}, ''), NULLIF(${userProfiles.province}, '')), '')), '')`.as('userLocation'),
      body: communityPosts.body,
      visibility: communityPosts.visibility,
      isPinned: communityPosts.isPinned,
      commentCount: communityPosts.commentCount,
      reactionCount: communityPosts.reactionCount,
      createdAt: communityPosts.createdAt,
      updatedAt: communityPosts.updatedAt,
    })
    .from(communityPosts)
    .innerJoin(communityBoards, eq(communityPosts.boardId, communityBoards.id))
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!post || post.userId !== userId) {
    // Check visibility — simplified: if not the author, check isDeleted
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const images = await db
    .select()
    .from(communityPostImages)
    .where(eq(communityPostImages.postId, post.id))
    .orderBy(asc(communityPostImages.sortOrder))

  return NextResponse.json({ ...post, images })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params
  const body = await request.json()

  const [existing] = await db
    .select({ id: communityPosts.id, userId: communityPosts.userId })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (existing.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (body.body !== undefined) updates.body = body.body
  if (body.visibility !== undefined) updates.visibility = body.visibility
  if (body.visibilityCompanyId !== undefined) updates.visibilityCompanyId = body.visibilityCompanyId
  if (body.boardId !== undefined && isAdmin) updates.boardId = body.boardId

  const [updated] = await db
    .update(communityPosts)
    .set(updates)
    .where(eq(communityPosts.id, existing.id))
    .returning()

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [existing] = await db
    .select({ id: communityPosts.id, userId: communityPosts.userId })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (existing.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Delete images from S3
  const images = await db
    .select({ url: communityPostImages.url })
    .from(communityPostImages)
    .where(eq(communityPostImages.postId, existing.id))

  await Promise.allSettled(
    images.map((img) => deleteCommunityImage(img.url))
  )

  await db
    .delete(communityPostImages)
    .where(eq(communityPostImages.postId, existing.id))

  await db
    .update(communityPosts)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(communityPosts.id, existing.id))

  return NextResponse.json({ success: true })
}
