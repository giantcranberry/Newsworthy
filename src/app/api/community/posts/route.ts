import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import {
  communityPosts,
  communityPostImages,
  communityBoards,
  communityGuidelines,
  communityGuidelineAcceptances,
  users,
  userProfiles,
  userFollows,
  companyMembers,
} from '@/db/schema'
import { and, desc, eq, lt, or, sql, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const boardSlug = searchParams.get('board')
  const authorId = searchParams.get('userId')
  const before = searchParams.get('before')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

  // Get user's followed user IDs for visibility filtering
  const followedRows = await db
    .select({ followingId: userFollows.followingId })
    .from(userFollows)
    .where(eq(userFollows.followerId, userId))

  const followedIds = followedRows.map((r) => r.followingId)

  // Get user's company IDs for team visibility
  const memberRows = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const companyIds = memberRows.map((r) => r.companyId)

  // Build conditions
  const conditions = [eq(communityPosts.isDeleted, false)]

  if (boardSlug) {
    const [board] = await db
      .select({ id: communityBoards.id })
      .from(communityBoards)
      .where(eq(communityBoards.slug, boardSlug))
      .limit(1)
    if (board) {
      conditions.push(eq(communityPosts.boardId, board.id))
    }
  }

  if (authorId) {
    conditions.push(eq(communityPosts.userId, parseInt(authorId)))
  }

  if (before) {
    conditions.push(lt(communityPosts.createdAt, new Date(before)))
  }

  // Visibility filter: show posts that are:
  // 1. public
  // 2. authored by current user
  // 3. team + user is member of that company
  // 4. followers + user follows the author
  const visibilityCondition = or(
    eq(communityPosts.visibility, 'public'),
    eq(communityPosts.userId, userId),
    and(
      eq(communityPosts.visibility, 'team'),
      companyIds.length > 0
        ? inArray(communityPosts.visibilityCompanyId, companyIds)
        : sql`FALSE`
    ),
    and(
      eq(communityPosts.visibility, 'followers'),
      followedIds.length > 0
        ? inArray(communityPosts.userId, followedIds)
        : sql`FALSE`
    )
  )

  conditions.push(visibilityCondition!)

  const posts = await db
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
    .where(and(...conditions))
    .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
    .limit(limit)

  // Fetch images for these posts
  if (posts.length > 0) {
    const postIds = posts.map((p) => p.id)
    const images = await db
      .select()
      .from(communityPostImages)
      .where(inArray(communityPostImages.postId, postIds))

    const imageMap = new Map<number, typeof images>()
    for (const img of images) {
      if (!imageMap.has(img.postId)) imageMap.set(img.postId, [])
      imageMap.get(img.postId)!.push(img)
    }

    return NextResponse.json(
      posts.map((p) => ({ ...p, images: imageMap.get(p.id) || [] }))
    )
  }

  return NextResponse.json(posts.map((p) => ({ ...p, images: [] })))
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check guidelines acceptance
  const [guidelines] = await db.select().from(communityGuidelines).limit(1)
  const [acceptance] = await db
    .select()
    .from(communityGuidelineAcceptances)
    .where(eq(communityGuidelineAcceptances.userId, userId))
    .limit(1)

  if (guidelines?.body) {
    const guidelinesUpdatedAt = guidelines.updatedAt ? new Date(guidelines.updatedAt) : null
    const acceptedAt = acceptance?.acceptedAt ? new Date(acceptance.acceptedAt) : null
    if (!acceptedAt || !guidelinesUpdatedAt || acceptedAt < guidelinesUpdatedAt) {
      return NextResponse.json({ error: 'You must accept the community guidelines before posting' }, { status: 403 })
    }
  }

  const body = await request.json()
  const { boardId, body: postBody, visibility, visibilityCompanyId, companyId } = body

  if (!boardId || !postBody?.trim()) {
    return NextResponse.json({ error: 'Board and body are required' }, { status: 400 })
  }

  // Check staff-only board restriction
  const [board] = await db
    .select({ staffOnly: communityBoards.staffOnly })
    .from(communityBoards)
    .where(eq(communityBoards.id, boardId))
    .limit(1)

  if (board?.staffOnly) {
    const isAdmin = (session?.user as any)?.isAdmin
    const isEditor = (session?.user as any)?.isEditor
    const isStaff = (session?.user as any)?.isStaff
    if (!isAdmin && !isEditor && !isStaff) {
      return NextResponse.json({ error: 'Only staff can post in this board' }, { status: 403 })
    }
  }

  const [post] = await db
    .insert(communityPosts)
    .values({
      uuid: randomUUID(),
      boardId,
      userId,
      body: postBody.trim(),
      visibility: visibility || 'public',
      visibilityCompanyId: visibility === 'team' ? visibilityCompanyId : null,
      companyId: companyId || null,
    })
    .returning()

  return NextResponse.json(post, { status: 201 })
}
