import {
  db,
  communityBoards,
  communityPosts,
  communityPostImages,
  users,
  userProfiles,
  eq,
  and,
  desc,
  asc,
  count,
  sql,
  lt,
} from '@/lib/db'

export async function getBoards() {
  return db
    .select({
      id: communityBoards.id,
      name: communityBoards.name,
      slug: communityBoards.slug,
      description: communityBoards.description,
      iconClass: communityBoards.iconClass,
      color: communityBoards.color,
      postCount: count(communityPosts.id),
    })
    .from(communityBoards)
    .leftJoin(
      communityPosts,
      and(
        eq(communityPosts.boardId, communityBoards.id),
        eq(communityPosts.isDeleted, false),
        eq(communityPosts.visibility, 'public')
      )
    )
    .where(
      and(
        eq(communityBoards.isDeleted, false),
        eq(communityBoards.isArchived, false)
      )
    )
    .groupBy(communityBoards.id)
    .orderBy(asc(communityBoards.sortOrder))
}

export async function getBoardBySlug(slug: string) {
  const [board] = await db
    .select()
    .from(communityBoards)
    .where(
      and(
        eq(communityBoards.slug, slug),
        eq(communityBoards.isDeleted, false),
        eq(communityBoards.isArchived, false)
      )
    )
    .limit(1)
  return board ?? null
}

export async function getPublicPosts(options: {
  boardId?: number
  limit?: number
  before?: string
} = {}) {
  const { boardId, limit = 20, before } = options

  const conditions = [
    eq(communityPosts.isDeleted, false),
    eq(communityPosts.visibility, 'public'),
  ]
  if (boardId) conditions.push(eq(communityPosts.boardId, boardId))
  if (before) conditions.push(lt(communityPosts.createdAt, new Date(before)))

  const posts = await db
    .select({
      id: communityPosts.id,
      uuid: communityPosts.uuid,
      body: communityPosts.body,
      isPinned: communityPosts.isPinned,
      commentCount: communityPosts.commentCount,
      reactionCount: communityPosts.reactionCount,
      createdAt: communityPosts.createdAt,
      boardName: communityBoards.name,
      boardSlug: communityBoards.slug,
      boardColor: communityBoards.color,
      userName: sql<string>`coalesce(${userProfiles.acctName}, ${userProfiles.firstName} || ' ' || ${userProfiles.lastName}, 'Community Member')`,
      userAvatar: userProfiles.avatar,
    })
    .from(communityPosts)
    .innerJoin(communityBoards, eq(communityPosts.boardId, communityBoards.id))
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
    .limit(limit)

  const postIds = posts.map(p => p.id)
  const images = postIds.length > 0
    ? await db
        .select()
        .from(communityPostImages)
        .where(sql`${communityPostImages.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(communityPostImages.sortOrder))
    : []

  return posts.map(post => ({
    ...post,
    images: images.filter(img => img.postId === post.id),
  }))
}

export async function getPostByUuid(uuid: string) {
  const [post] = await db
    .select({
      id: communityPosts.id,
      uuid: communityPosts.uuid,
      body: communityPosts.body,
      isPinned: communityPosts.isPinned,
      visibility: communityPosts.visibility,
      commentCount: communityPosts.commentCount,
      reactionCount: communityPosts.reactionCount,
      createdAt: communityPosts.createdAt,
      boardName: communityBoards.name,
      boardSlug: communityBoards.slug,
      boardColor: communityBoards.color,
      boardDescription: communityBoards.description,
      userName: sql<string>`coalesce(${userProfiles.acctName}, ${userProfiles.firstName} || ' ' || ${userProfiles.lastName}, 'Community Member')`,
      userAvatar: userProfiles.avatar,
      userBio: userProfiles.bio,
    })
    .from(communityPosts)
    .innerJoin(communityBoards, eq(communityPosts.boardId, communityBoards.id))
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.id))
    .where(
      and(
        eq(communityPosts.uuid, uuid),
        eq(communityPosts.isDeleted, false),
        eq(communityPosts.visibility, 'public')
      )
    )
    .limit(1)

  if (!post) return null

  const images = await db
    .select()
    .from(communityPostImages)
    .where(eq(communityPostImages.postId, post.id))
    .orderBy(asc(communityPostImages.sortOrder))

  return { ...post, images }
}
