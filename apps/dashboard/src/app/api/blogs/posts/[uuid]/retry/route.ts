import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { blogPosts, blogFeeds } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const { uuid } = await params

  const episode = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.uuid, uuid),
    columns: { id: true, feedId: true, generationStatus: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const feed = await db.query.blogFeeds.findFirst({
    where: eq(blogFeeds.id, episode.feedId),
    columns: { companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (episode.generationStatus !== 'failed') {
    return NextResponse.json(
      { error: `Only failed episodes can be retried (status: ${episode.generationStatus})` },
      { status: 409 },
    )
  }

  // Atomic reset — only flips if still 'failed'
  const result = await db
    .update(blogPosts)
    .set({
      generationStatus: 'pending',
      generationError: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(blogPosts.id, episode.id), eq(blogPosts.generationStatus, 'failed')),
    )
    .returning({ id: blogPosts.id })

  if (result.length === 0) {
    return NextResponse.json({ error: 'Status changed; refresh and try again' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, status: 'pending' })
}
