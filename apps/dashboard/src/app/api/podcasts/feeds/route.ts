import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastFeeds, podcastEpisodes, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { parsePodcastFeed } from '@/lib/podcasts/parse-feed'
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

  const existing = await db.query.podcastFeeds.findFirst({
    where: and(eq(podcastFeeds.companyId, brand.id), eq(podcastFeeds.isDeleted, false)),
    columns: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: 'This brand already has a podcast feed.' }, { status: 409 })
  }

  let parsedFeed
  try {
    parsedFeed = await parsePodcastFeed(feedUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Could not read RSS feed: ${msg}` }, { status: 422 })
  }

  const now = new Date()
  const lastEpisodeAt = parsedFeed.episodes
    .map((e) => e.publishedAt)
    .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]

  const [feed] = await db.insert(podcastFeeds).values({
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
    itunesCategory: parsedFeed.itunesCategory?.slice(0, 128),
    lastFetchedAt: now,
    lastEpisodePublishedAt: lastEpisodeAt,
  }).returning()

  if (parsedFeed.episodes.length > 0) {
    const rows = parsedFeed.episodes.map((e) => ({
      uuid: uuidv4(),
      feedId: feed.id,
      guid: e.guid.slice(0, 512),
      title: e.title?.slice(0, 512),
      description: e.description,
      audioUrl: e.audioUrl,
      audioType: e.audioType?.slice(0, 64),
      audioLengthBytes: e.audioLengthBytes ?? null,
      durationSeconds: e.durationSeconds ?? null,
      episodeNumber: e.episodeNumber ?? null,
      seasonNumber: e.seasonNumber ?? null,
      episodeType: e.episodeType?.slice(0, 16),
      imageUrl: e.imageUrl,
      chaptersUrl: e.chaptersUrl,
      link: e.link,
      publishedAt: e.publishedAt ?? null,
      explicit: e.explicit ?? false,
    }))
    await db
      .insert(podcastEpisodes)
      .values(rows)
      .onConflictDoNothing({ target: [podcastEpisodes.feedId, podcastEpisodes.guid] })
  }

  return NextResponse.json({
    uuid: feed.uuid,
    title: feed.title,
    episodeCount: parsedFeed.episodes.length,
  })
}
