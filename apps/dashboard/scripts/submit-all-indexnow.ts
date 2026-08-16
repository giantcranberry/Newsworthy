/**
 * One-shot: submit all published (status=sent) press release URLs to IndexNow.
 *
 * Usage (from repo root or apps/dashboard):
 *   INDEXNOW_API_KEY=... bun apps/dashboard/scripts/submit-all-indexnow.ts
 */
import { db } from '../src/db'
import { releases } from '../src/db/schema'
import { and, eq, isNotNull, or, isNull, sql } from 'drizzle-orm'
import {
  buildIndexNowReleaseUrl,
  submitToIndexNow,
} from '../src/lib/indexnow'

const BATCH_SIZE = 1000

async function main() {
  if (!process.env.INDEXNOW_API_KEY) {
    console.error('INDEXNOW_API_KEY is not set')
    process.exit(1)
  }

  console.log('Fetching published (sent) press releases...')

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
        sql`${releases.releaseAt} <= NOW()`
      )
    )

  const urls = [
    ...new Set(
      rows
        .map((r) => buildIndexNowReleaseUrl(r))
        .filter((u): u is string => Boolean(u))
    ),
  ]

  console.log(`Found ${urls.length} published press release URLs`)
  if (urls.length === 0) process.exit(0)

  let submitted = 0
  let failed = 0

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(urls.length / BATCH_SIZE)
    console.log(`Submitting batch ${batchNum}/${totalBatches} (${batch.length} URLs)...`)

    const result = await submitToIndexNow(batch)
    if (result.ok) {
      submitted += result.submitted
      console.log(`  OK (${result.status}) — ${result.submitted} URLs`)
    } else {
      failed += batch.length
      console.error(`  FAILED (${result.status ?? 'error'})`)
    }

    if (i + BATCH_SIZE < urls.length) {
      await Bun.sleep(1000)
    }
  }

  console.log(`\nDone. Submitted: ${submitted}, Failed batch URLs: ${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
