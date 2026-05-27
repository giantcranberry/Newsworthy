import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastEpisodes, podcastFeeds } from '@/db/schema'
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

  const episode = await db.query.podcastEpisodes.findFirst({
    where: eq(podcastEpisodes.uuid, uuid),
    columns: { id: true, feedId: true, transcriptionStatus: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const feed = await db.query.podcastFeeds.findFirst({
    where: eq(podcastFeeds.id, episode.feedId),
    columns: { companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (episode.transcriptionStatus !== 'failed') {
    return NextResponse.json(
      { error: `Only failed episodes can be retried (status: ${episode.transcriptionStatus})` },
      { status: 409 },
    )
  }

  // Atomic reset — only flips if still 'failed'
  const result = await db
    .update(podcastEpisodes)
    .set({
      transcriptionStatus: 'pending',
      transcriptionError: null,
      updatedAt: new Date(),
    })
    .where(
      and(eq(podcastEpisodes.id, episode.id), eq(podcastEpisodes.transcriptionStatus, 'failed')),
    )
    .returning({ id: podcastEpisodes.id })

  if (result.length === 0) {
    return NextResponse.json({ error: 'Status changed; refresh and try again' }, { status: 409 })
  }

  return NextResponse.json({ ok: true, status: 'pending' })
}
