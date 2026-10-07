import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { blogPosts, blogFeeds } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const { uuid } = await params

  const post = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.uuid, uuid),
    columns: { id: true, feedId: true, title: true, content: true, summary: true, link: true, author: true },
  })
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const feed = await db.query.blogFeeds.findFirst({
    where: eq(blogFeeds.id, post.feedId),
    columns: { companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId)
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const text = (post.content || post.summary || '').trim()
  if (!text) {
    return NextResponse.json({ error: 'This post has no article content yet' }, { status: 404 })
  }

  return NextResponse.json({
    title: post.title,
    text,
    author: post.author,
    link: post.link,
  })
}
