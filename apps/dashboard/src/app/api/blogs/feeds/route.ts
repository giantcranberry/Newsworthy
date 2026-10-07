import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { blogFeeds, blogPosts, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { parseBlogFeed } from '@/lib/blogs/parse-feed'
import { getUserCompanyIds } from '@/lib/team-auth'

const bodySchema = z.object({
  companyUuid: z.string().min(1),
  feedUrl: z.string().url(),
})

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { companyUuid, feedUrl } = parsed.data

  const brand = await db.query.company.findFirst({
    where: and(eq(company.uuid, companyUuid), eq(company.isDeleted, false)),
    columns: { id: true },
  })
  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(brand.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = await db.query.blogFeeds.findFirst({
    where: and(eq(blogFeeds.companyId, brand.id), eq(blogFeeds.isDeleted, false)),
    columns: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'This brand already has a blog feed.' }, { status: 409 })
  }

  let parsedFeed
  try {
    parsedFeed = await parseBlogFeed(feedUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not read RSS feed: ${msg}` }, { status: 422 })
  }

  const now = new Date()
  const lastPostAt = parsedFeed.posts
    .map((e) => e.publishedAt)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  const [feed] = await db.insert(blogFeeds).values({
    uuid: uuidv4(),
    companyId: brand.id,
    userId,
    feedUrl,
    title: parsedFeed.title.slice(0, 255),
    description: parsedFeed.description,
    imageUrl: parsedFeed.imageUrl,
    author: parsedFeed.author?.slice(0, 255),
    language: parsedFeed.language?.slice(0, 16),
    link: parsedFeed.link,
    category: parsedFeed.category?.slice(0, 128),
    lastFetchedAt: now,
    lastPostPublishedAt: lastPostAt,
  }).returning()

  if (parsedFeed.posts.length > 0) {
    const rows = parsedFeed.posts.map((e) => ({
      uuid: uuidv4(),
      feedId: feed.id,
      guid: e.guid.slice(0, 512),
      title: e.title?.slice(0, 512),
      summary: e.summary,
      content: e.content,
      imageUrl: e.imageUrl,
      author: e.author?.slice(0, 255),
      link: e.link,
      publishedAt: e.publishedAt ?? null,
      // Skip the entire back catalog on import; the user opts posts in.
      skip: true,
    }))
    await db
      .insert(blogPosts)
      .values(rows)
      .onConflictDoNothing({ target: [blogPosts.feedId, blogPosts.guid] })
  }

  return NextResponse.json({
    uuid: feed.uuid,
    title: feed.title,
    postCount: parsedFeed.posts.length,
  })
}
