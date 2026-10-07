import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { blogPosts, blogFeeds } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getUserCompanyIds } from '@/lib/team-auth'

const bodySchema = z.object({ skip: z.boolean() })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const { uuid } = await params
  const json = await request.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const episode = await db.query.blogPosts.findFirst({
    where: eq(blogPosts.uuid, uuid),
    columns: { id: true, feedId: true },
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

  await db
    .update(blogPosts)
    .set({ skip: parsed.data.skip, updatedAt: new Date() })
    .where(eq(blogPosts.id, episode.id))

  return NextResponse.json({ ok: true, skip: parsed.data.skip })
}
