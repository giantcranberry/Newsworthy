import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastFeeds, podcastEpisodes } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
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

  const feed = await db.query.podcastFeeds.findFirst({
    where: and(eq(podcastFeeds.uuid, uuid), eq(podcastFeeds.isDeleted, false)),
    columns: { id: true, companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await db
    .update(podcastEpisodes)
    .set({ skip: parsed.data.skip, updatedAt: new Date() })
    .where(eq(podcastEpisodes.feedId, feed.id))
    .returning({ id: podcastEpisodes.id })

  return NextResponse.json({ ok: true, updated: result.length, skip: parsed.data.skip })
}
