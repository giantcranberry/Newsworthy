import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, companyMembers, company } from '@/db/schema'
import { eq, and, or, isNull, inArray } from 'drizzle-orm'
import { queryIndex } from '@/lib/opensearch'

export async function GET(request: Request) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filterCompanyId = searchParams.get('companyId')

  // Get all company IDs the user has access to
  const ownedCompanies = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
    columns: { id: true },
  })
  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const allCompanyIds = [
    ...new Set([
      ...ownedCompanies.map((c) => c.id),
      ...memberships.map((m) => m.companyId),
    ]),
  ]

  // If filtering by company, verify user has access
  const targetCompanyIds = filterCompanyId
    ? allCompanyIds.includes(Number(filterCompanyId)) ? [Number(filterCompanyId)] : []
    : allCompanyIds

  if (filterCompanyId && targetCompanyIds.length === 0) {
    return NextResponse.json({ stats: [], interval: 'month' })
  }

  // Get all sent releases with prhash_ids
  const releaseFilter = filterCompanyId
    ? and(
        inArray(releases.companyId, targetCompanyIds),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
        eq(releases.status, 'sent'),
      )
    : and(
        or(
          eq(releases.userId, userId),
          allCompanyIds.length > 0 ? inArray(releases.companyId, allCompanyIds) : undefined,
        ),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
        eq(releases.status, 'sent'),
      )

  const sentReleases = await db.query.releases.findMany({
    where: releaseFilter,
    columns: { prhashId: true, releasedAt: true },
  })

  const prhashIds = sentReleases
    .map((r) => r.prhashId)
    .filter((id): id is string => !!id)

  if (!prhashIds.length) {
    return NextResponse.json({ stats: [], interval: 'month' })
  }

  const interval = 'month'
  const timeFormat = 'MM/yyyy'

  // Count releases per month from releasedAt dates
  const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const releaseCountByKey: Record<string, number> = {}
  for (const r of sentReleases) {
    if (!r.releasedAt) continue
    const d = r.releasedAt
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const key = `${mm}/${yyyy}`
    releaseCountByKey[key] = (releaseCountByKey[key] || 0) + 1
  }

  try {
    // Aggregate pageviews time series across all releases
    const pvQuery = {
      size: 0,
      query: { terms: { 'prhash_id.keyword': prhashIds } },
      aggs: {
        over_time: {
          date_histogram: { field: 'created_at', interval, format: timeFormat },
        },
      },
    }
    const pvResult = await queryIndex('nw_pageviews', pvQuery)
    const pvBuckets: any[] = pvResult.aggregations?.over_time?.buckets || []

    // Merge newsramp stats
    try {
      const nrQuery = {
        size: 0,
        query: { terms: { prhash_id: prhashIds } },
        aggs: {
          over_time: {
            date_histogram: { field: 'timestamp', interval, format: timeFormat },
          },
        },
      }
      const nrResult = await queryIndex('newsramp_stats', nrQuery)
      if (nrResult?.aggregations?.over_time?.buckets) {
        const pvByKey: Record<string, any> = {}
        for (const b of pvBuckets) pvByKey[b.key_as_string] = b
        for (const nr of nrResult.aggregations.over_time.buckets) {
          if (pvByKey[nr.key_as_string]) {
            pvByKey[nr.key_as_string].doc_count += nr.doc_count
          } else {
            pvBuckets.push(nr)
          }
        }
        pvBuckets.sort((a: any, b: any) => a.key - b.key)
      }
    } catch {
      // newsramp_stats may not exist
    }

    // Aggregate shares time series
    const shQuery = {
      size: 0,
      query: {
        bool: {
          must: [
            { terms: { 'prhash_id.keyword': prhashIds } },
            { exists: { field: 'utm' } },
          ],
        },
      },
      aggs: {
        over_time: {
          date_histogram: { field: 'created_at', interval, format: timeFormat },
        },
      },
    }
    const shResult = await queryIndex('nw_shares', shQuery)
    const shBuckets: any[] = shResult.aggregations?.over_time?.buckets || []

    // Build combined time-series
    const stats: { label: string; key: string; views: number; shares: number; releases: number }[] = []
    const existingDates: Record<string, number> = {}

    // Collect all unique month keys from all sources
    const allKeys = new Set<string>()
    for (const bucket of pvBuckets) allKeys.add(bucket.key_as_string)
    for (const bucket of shBuckets) allKeys.add(bucket.key_as_string)
    for (const key of Object.keys(releaseCountByKey)) allKeys.add(key)

    // Create pvBuckets lookup
    const pvByKey: Record<string, number> = {}
    for (const b of pvBuckets) pvByKey[b.key_as_string] = b.doc_count

    // Create shBuckets lookup
    const shByKey: Record<string, number> = {}
    for (const b of shBuckets) shByKey[b.key_as_string] = b.doc_count

    // Sort keys chronologically
    const sortedKeys = [...allKeys].sort((a, b) => {
      const [am, ay] = a.split('/').map(Number)
      const [bm, by] = b.split('/').map(Number)
      return ay !== by ? ay - by : am - bm
    })

    for (const key of sortedKeys) {
      const parts = key.split('/')
      const label = `${MONTH_NAMES[parseInt(parts[0])]} ${parts[1]}`
      stats.push({
        label,
        key,
        views: pvByKey[key] || 0,
        shares: shByKey[key] || 0,
        releases: releaseCountByKey[key] || 0,
      })
    }

    return NextResponse.json({ stats, interval })
  } catch (err) {
    console.error('Engagement stats API error:', err)
    return NextResponse.json({ stats: [], interval: 'month' })
  }
}
