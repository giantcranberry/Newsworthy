import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { and, eq, gte, isNotNull, isNull, or, sql } from 'drizzle-orm'
import {
  buildIndexNowReleaseUrl,
  submitToIndexNow,
} from '@/lib/indexnow'

/**
 * POST /api/cron/indexnow
 * Submit recently published press releases to IndexNow.
 * Catches status=sent flips that happen outside this app.
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const hours = Math.min(
    48,
    Math.max(1, Number(request.nextUrl.searchParams.get('hours') || 6))
  )
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

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
          and(isNull(releases.releasedAt), gte(releases.releaseAt, since))
        ),
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

  if (urls.length === 0) {
    return NextResponse.json({ ok: true, submitted: 0, hours })
  }

  const result = await submitToIndexNow(urls)
  return NextResponse.json({
    ok: result.ok,
    status: result.status,
    submitted: result.submitted,
    found: urls.length,
    hours,
  })
}
