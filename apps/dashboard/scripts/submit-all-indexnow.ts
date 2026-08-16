/**
 * Submit recent /news and /curated URLs to IndexNow (default: last 30 days).
 *
 * Usage:
 *   INDEXNOW_API_KEY=... bun apps/dashboard/scripts/submit-all-indexnow.ts
 *   INDEXNOW_API_KEY=... bun apps/dashboard/scripts/submit-all-indexnow.ts --days=30
 *
 * Curated articles need NEON_DIRECT_URL (e.g. via Doppler for newsworthy-website).
 */
import postgres from 'postgres'
import { db } from '../src/db'
import { releases } from '../src/db/schema'
import { and, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm'
import {
  INDEXNOW_SITE_ORIGIN,
  buildIndexNowReleaseUrl,
  submitToIndexNow,
} from '../src/lib/indexnow'

const BATCH_SIZE = 1000

function parseDays(): number {
  const arg = process.argv.find((a) => a.startsWith('--days='))
  const n = arg ? Number(arg.slice('--days='.length)) : 30
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 30
}

/** Match apps/website/lib/article_utils.ts slugify */
function slugify(headline: string): string {
  let slug = headline.toLowerCase().replace(/[\s\W-]+/g, '-')
  if (slug.length > 64) slug = slug.substring(0, 64)
  return slug.replace(/-+$/g, '')
}

async function fetchNewsUrls(since: Date): Promise<string[]> {
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
        gte(releases.releaseAt, since),
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

async function fetchCuratedUrls(since: Date): Promise<string[]> {
  const neonUrl = process.env.NEON_DIRECT_URL?.trim().replace(/^["']|["']$/g, '')
  if (!neonUrl) {
    console.warn('NEON_DIRECT_URL is not set — skipping /curated URLs')
    return []
  }

  const sqlClient = postgres(neonUrl, { prepare: false, max: 1 })
  try {
    const rows = await sqlClient<{
      id: number
      title: string | null
      released_at: Date
    }[]>`
      SELECT
        f.id AS id,
        a.article_json->>'headline' AS title,
        f.published AS released_at
      FROM articles a
      INNER JOIN feeditem f ON f.id = a.feed_item_id
      INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
      WHERE f.deleted_at IS NULL
        AND a.target = 'newsworthy.ai'
        AND f.published >= ${since}
        AND f.published <= NOW()
      ORDER BY f.published DESC
    `

    const urls: string[] = []
    for (const row of rows) {
      if (!row.title) continue
      const year = new Date(row.released_at).getFullYear()
      urls.push(
        `${INDEXNOW_SITE_ORIGIN}/curated/${slugify(row.title)}/${year}${row.id}`
      )
    }
    return [...new Set(urls)]
  } finally {
    await sqlClient.end({ timeout: 5 })
  }
}

async function submitBatches(urls: string[], label: string): Promise<{ submitted: number; failed: number }> {
  let submitted = 0
  let failed = 0
  if (urls.length === 0) {
    console.log(`${label}: 0 URLs`)
    return { submitted, failed }
  }

  const totalBatches = Math.ceil(urls.length / BATCH_SIZE)
  console.log(`${label}: ${urls.length} URLs (${totalBatches} batch${totalBatches === 1 ? '' : 'es'})`)

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`  Submitting ${label} batch ${batchNum}/${totalBatches} (${batch.length})...`)

    const result = await submitToIndexNow(batch)
    if (result.ok) {
      submitted += result.submitted
      console.log(`    OK (${result.status}) — ${result.submitted}`)
    } else {
      failed += batch.length
      console.error(`    FAILED (${result.status ?? 'error'})`)
    }

    if (i + BATCH_SIZE < urls.length) {
      await Bun.sleep(1000)
    }
  }

  return { submitted, failed }
}

async function main() {
  if (!process.env.INDEXNOW_API_KEY) {
    console.error('INDEXNOW_API_KEY is not set')
    process.exit(1)
  }

  const days = parseDays()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  console.log(`IndexNow: last ${days} days (since ${since.toISOString()})`)
  console.log(`Host: ${INDEXNOW_SITE_ORIGIN}`)

  const [newsUrls, curatedUrls] = await Promise.all([
    fetchNewsUrls(since),
    fetchCuratedUrls(since),
  ])

  const news = await submitBatches(newsUrls, '/news')
  if (newsUrls.length && curatedUrls.length) await Bun.sleep(1000)
  const curated = await submitBatches(curatedUrls, '/curated')

  const submitted = news.submitted + curated.submitted
  const failed = news.failed + curated.failed
  console.log(`\nDone. Submitted: ${submitted}, Failed batch URLs: ${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
