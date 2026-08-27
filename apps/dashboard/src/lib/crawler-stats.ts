import { unstable_cache } from 'next/cache'
import { db, pageHits, and, gte, inArray, count } from '@nwai/db'

export type CrawlerStats24h = {
  aiHits: number
  seoHits: number
}

async function fetchCrawlerStatsLast24h(): Promise<CrawlerStats24h> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  try {
    const rows = await db
      .select({
        visitor: pageHits.visitor,
        hitCount: count(),
      })
      .from(pageHits)
      .where(
        and(
          gte(pageHits.createdAt, since),
          inArray(pageHits.visitor, ['ai', 'seo']),
        ),
      )
      .groupBy(pageHits.visitor)

    let aiHits = 0
    let seoHits = 0
    for (const row of rows) {
      if (row.visitor === 'ai') aiHits = Number(row.hitCount)
      if (row.visitor === 'seo') seoHits = Number(row.hitCount)
    }
    return { aiHits, seoHits }
  } catch (err) {
    console.error('[crawler-stats] failed to load 24h counts', err)
    return { aiHits: 0, seoHits: 0 }
  }
}

export const getCrawlerStatsLast24h = unstable_cache(
  fetchCrawlerStatsLast24h,
  ['crawler-stats-last-24h'],
  { revalidate: 600 },
)
