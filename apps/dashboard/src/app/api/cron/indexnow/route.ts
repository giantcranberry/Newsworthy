import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { and, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm'
import {
  buildIndexNowCuratedUrl,
  buildIndexNowReleaseUrl,
  submitToIndexNow,
} from '@/lib/indexnow'

/**
 * GET|POST /api/cron/indexnow?hours=1
 *
 * Submits recent /news and /curated URLs to IndexNow.
 * Default window: last 1 hour (override with ?hours=1..48).
 *
 * curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *   "https://app.newsworthy.ai/api/cron/indexnow?hours=1"
 *
 * Env: CRON_SECRET, INDEXNOW_API_KEY, NEON_DIRECT_URL (for /curated)
 */
async function runIndexNowCron(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hours = Math.min(
    48,
    Math.max(1, Number(request.nextUrl.searchParams.get('hours') || 1))
  )
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const [newsUrls, curatedUrls] = await Promise.all([
    fetchRecentNewsUrls(since),
    fetchRecentCuratedUrls(since),
  ])

  const urls = [...new Set([...newsUrls, ...curatedUrls])]

  if (urls.length === 0) {
    return NextResponse.json({
      ok: true,
      hours,
      since: since.toISOString(),
      news: 0,
      curated: 0,
      found: 0,
      submitted: 0,
    })
  }

  const result = await submitToIndexNow(urls)
  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    hours,
    since: since.toISOString(),
    news: newsUrls.length,
    curated: curatedUrls.length,
    found: urls.length,
    submitted: result.submitted,
  })
}

async function fetchRecentNewsUrls(since: Date): Promise<string[]> {
  const rows = await db
    .select({
      id: releases.id,
      slug: releases.slug,
      releaseAt: releases.releaseAt,
    })
    .from(releases)
    .where(
      and(
        eq(releases.status, 'sent'),
        isNotNull(releases.slug),
        isNotNull(releases.releaseAt),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
        or(
          gte(releases.releasedAt, since),
          and(isNull(releases.releasedAt), gte(releases.releaseAt, since)),
          gte(releases.releaseAt, since)
        ),
        sql`${releases.releaseAt} <= NOW()`
      )
    )

  return [
    ...new Set(
      rows
        .map((r) => buildIndexNowReleaseUrl(r))
        .filter((u): u is string => Boolean(u))
    ),
  ]
}

async function fetchRecentCuratedUrls(since: Date): Promise<string[]> {
  const neonUrl = process.env.NEON_DIRECT_URL?.trim().replace(/^["']|["']$/g, '')
  if (!neonUrl) {
    console.warn('IndexNow cron: NEON_DIRECT_URL is not set; skipping /curated')
    return []
  }

  const sqlClient = postgres(neonUrl, { prepare: false, max: 1 })
  try {
    const rows = await sqlClient<{
      id: number
      title: string | null
      published: Date
    }[]>`
      SELECT
        f.id AS id,
        a.article_json->>'headline' AS title,
        f.published AS published
      FROM articles a
      INNER JOIN feeditem f ON f.id = a.feed_item_id
      INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
      WHERE f.deleted_at IS NULL
        AND a.target = 'newsworthy.ai'
        AND f.published >= ${since}
        AND f.published <= NOW()
      ORDER BY f.published DESC
    `

    return [
      ...new Set(
        rows
          .map((r) =>
            buildIndexNowCuratedUrl({
              id: r.id,
              title: r.title,
              publishedAt: r.published,
            })
          )
          .filter((u): u is string => Boolean(u))
      ),
    ]
  } catch (error) {
    console.error('IndexNow cron: curated fetch failed', error)
    return []
  } finally {
    await sqlClient.end({ timeout: 5 })
  }
}

export async function GET(request: NextRequest) {
  return runIndexNowCron(request)
}

export async function POST(request: NextRequest) {
  return runIndexNowCron(request)
}
