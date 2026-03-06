import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  communityBoards,
  communityPosts,
  communityPostImages,
  communityComments,
  communityReactions,
} from '@/db/schema'
import { eq, inArray, and } from 'drizzle-orm'
import { deleteCommunityImage } from '@/services/s3'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const boardId = parseInt(id)
  if (isNaN(boardId)) {
    return NextResponse.json({ error: 'Invalid board ID' }, { status: 400 })
  }

  const body = await request.json()
  if (!body.confirm) {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  // Verify board exists
  const [board] = await db
    .select({ id: communityBoards.id })
    .from(communityBoards)
    .where(eq(communityBoards.id, boardId))
    .limit(1)

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  // Get all post IDs for this board
  const posts = await db
    .select({ id: communityPosts.id })
    .from(communityPosts)
    .where(eq(communityPosts.boardId, boardId))

  const postIds = posts.map((p) => p.id)

  if (postIds.length > 0) {
    // Get all comment IDs for these posts
    const comments = await db
      .select({ id: communityComments.id })
      .from(communityComments)
      .where(inArray(communityComments.postId, postIds))

    const commentIds = comments.map((c) => c.id)

    // 1. Delete reactions on comments
    if (commentIds.length > 0) {
      await db
        .delete(communityReactions)
        .where(
          and(
            eq(communityReactions.targetType, 'comment'),
            inArray(communityReactions.targetId, commentIds)
          )
        )
    }

    // 2. Delete reactions on posts
    await db
      .delete(communityReactions)
      .where(
        and(
          eq(communityReactions.targetType, 'post'),
          inArray(communityReactions.targetId, postIds)
        )
      )

    // 3. Delete comments
    await db
      .delete(communityComments)
      .where(inArray(communityComments.postId, postIds))

    // 4. Delete post images (S3 + DB)
    const images = await db
      .select({ url: communityPostImages.url })
      .from(communityPostImages)
      .where(inArray(communityPostImages.postId, postIds))

    // Best-effort S3 cleanup — don't block on failures
    await Promise.allSettled(
      images.map((img) => deleteCommunityImage(img.url))
    )

    await db
      .delete(communityPostImages)
      .where(inArray(communityPostImages.postId, postIds))

    // 5. Delete posts
    await db
      .delete(communityPosts)
      .where(eq(communityPosts.boardId, boardId))
  }

  return NextResponse.json({ success: true, deletedPosts: postIds.length })
}
