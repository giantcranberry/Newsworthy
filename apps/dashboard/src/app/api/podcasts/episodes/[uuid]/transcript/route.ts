import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastEpisodes, podcastFeeds, podcastEpisodeTranscripts } from '@/db/schema'
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

  const episode = await db.query.podcastEpisodes.findFirst({
    where: eq(podcastEpisodes.uuid, uuid),
    columns: { id: true, feedId: true, title: true },
  })
  if (!episode) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const feed = await db.query.podcastFeeds.findFirst({
    where: eq(podcastFeeds.id, episode.feedId),
    columns: { companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId)
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transcript = await db.query.podcastEpisodeTranscripts.findFirst({
    where: eq(podcastEpisodeTranscripts.episodeId, episode.id),
    columns: {
      text: true,
      segments: true,
      language: true,
      durationSeconds: true,
      provider: true,
      model: true,
      createdAt: true,
    },
  })
  if (!transcript) {
    return NextResponse.json({ error: 'No transcript yet' }, { status: 404 })
  }

  return NextResponse.json({
    episodeTitle: episode.title,
    text: transcript.text,
    segments: transcript.segments,
    language: transcript.language,
    durationSeconds: transcript.durationSeconds,
    provider: transcript.provider,
    model: transcript.model,
    createdAt: transcript.createdAt.toISOString(),
  })
}
