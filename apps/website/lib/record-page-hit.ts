import { db, pageHits } from '@nwai/db'
import { classifyUserAgent } from '@/lib/classify-user-agent'
import { parsePrIdFromNewsPath } from '@/lib/parse-news-pr-id'

/**
 * Insert a page_hits row for SEO, AI, or other (unknown) crawlers.
 * Browsers are skipped. Fire-and-forget safe: never throws to the caller.
 */
export async function recordCrawlerHit(input: {
  pageUrl: string
  path: string
  userAgent?: string | null
}): Promise<boolean> {
  try {
    const { visitor, botName } = classifyUserAgent(input.userAgent)
    if (visitor === 'browser') return false

    await db.insert(pageHits).values({
      id: crypto.randomUUID(),
      pageUrl: input.pageUrl.slice(0, 2048),
      path: input.path.slice(0, 1024),
      visitor,
      botName,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      prId: parsePrIdFromNewsPath(input.path),
    })
    return true
  } catch (err) {
    console.error('[page_hits] failed to record crawler hit', err)
    return false
  }
}
