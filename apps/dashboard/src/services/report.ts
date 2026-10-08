import { db } from '@/db'
import { releases, releaseEnhanced, releasePlacements, releaseOptions, releaseCategories } from '@/db/schema'
import { clipReport, pdfDownloads, crmContacts } from '@/db/schema'
import { circuits, circuitCategories } from '@/db/schema'
import { users, pageHits, releaseGrounding } from '@/db/schema'
import { eq, and, inArray, count, sql, min, max, desc, asc } from 'drizzle-orm'
import { queryIndex } from '@/lib/opensearch'

// --- 4-hour in-memory cache ---
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours
interface CacheEntry {
  data: ReportData
  fetchedAt: number
}
const reportCache = new Map<string, CacheEntry>()

// --- Types ---
export interface ClipRecord {
  id: number
  name: string | null
  network: string | null
  city: string | null
  state: string | null
  logo: string | null
  link: string | null
}

export interface TimeBucket {
  key_as_string: string
  views: number
  shares: number
  shares_multiplied?: number
}

export interface CircuitsData {
  hr: boolean
  cannabis: boolean
  cannadelic: boolean
  psychedelics: boolean
  data: {
    reddit: ClipRecord | false
    hrtechfeed: { link: string } | false
    weedweek: boolean
  }
}

export interface EnhancedPublication {
  name: string
  link: string
  logo_url: string
}

/** One crawler (by bot name) and how often it fetched this release */
export interface CrawlerBotStat {
  botName: string
  hits: number
  firstSeen: string | null
  lastSeen: string | null
}

export interface CrawlerGroup {
  total: number
  bots: CrawlerBotStat[]
  firstSeen: string | null
  lastSeen: string | null
}

export interface CrawlerDailyBucket {
  date: string // YYYY-MM-DD (UTC)
  aiTraining: number
  aiGrounding: number
  seo: number
}

/** One bucket on the views/shares chart. `label` matches that chart's key. */
export interface CrawlerActivityBucket {
  label: string
  aiTraining: number
  aiGrounding: number
  seo: number
}

/**
 * Crawler traffic on the release's public article pages (newsworthy.ai),
 * split into AI training crawlers, AI grounding / answer-engine fetchers,
 * and classic search-engine indexers.
 */
export interface CrawlerStats {
  aiTraining: CrawlerGroup
  aiGrounding: CrawlerGroup
  seo: CrawlerGroup
  daily: CrawlerDailyBucket[]
  /** Same interval as views and shares: hour, day, or month. Hourly counts come from page_hits.created_at. */
  activity: CrawlerActivityBucket[]
}

/** A confirmed citation of our distribution network by an AI search product */
export interface GroundingCitation {
  source: string // google_ai_overview | openai | perplexity
  sourceLabel: string
  query: string
  createdAt: string
}

export interface AiGroundingData {
  citations: GroundingCitation[]
  /** Distinct sources that have cited the release */
  sources: string[]
}

export interface ReportData {
  release: {
    id: number
    uuid: string
    title: string | null
    abstract: string | null
    slug: string | null
    location: string | null
    releasedAt: string | null
    releaseAt: string | null
    prhashId: string | null
    status: string
    score: number | null
  }
  company: {
    id: number
    uuid: string
    companyName: string
    logoUrl: string | null
  }
  clips: {
    synacor: ClipRecord[]
    gomedia: ClipRecord[]
    fcmarkets: ClipRecord[]
    marketminute: ClipRecord[]
    redditNP: ClipRecord | null
    streetinsiderUrl: string | null
  }
  totalPv: number
  totalSh: number
  ecpc: string
  combStats: TimeBucket[]
  constGrowthStats: TimeBucket[]
  shStatsMultiplier: number
  releaseIsYearOld: boolean
  hasAdvGroup: boolean
  // Active advocate contacts in the brand's share list — drives the Total
  // Shares card CTA when there are no shares yet
  shareListCount: number
  nwrampReport: any | false
  enhancedPublications: EnhancedPublication[]
  yahooFinanceUrls: string[]
  circuits: CircuitsData
  pdfDownloadCount: number
  // Crawler + AI visibility. Optional because reports cached before these
  // fields existed will not have them.
  crawlerStats?: CrawlerStats
  aiGrounding?: AiGroundingData
  encodedTitle: string
  fetchedAt: string
}

// --- Circuit category IDs (from Flask data/circuits.py) ---
const CIRCUIT_CATEGORY_IDS = {
  hr: [29, 34, 216, 217, 218, 219, 221, 254, 260],
  cannadelic: [125, 237, 236],
  cannabis: [125, 237],
  psychedelics: [236],
}

// --- OpenSearch query helpers ---

export async function getClipsTotalStats(prhashIds: string[]): Promise<{ pageviews: Record<string, number>; shares: Record<string, number> }> {
  const pageviews: Record<string, number> = {}
  const shares: Record<string, number> = {}

  if (!prhashIds.length) return { pageviews, shares }

  try {
    // Pageviews from nw_pageviews
    const pvQuery = {
      size: 0,
      query: { terms: { 'prhash_id.keyword': prhashIds } },
      aggs: { group_by_prhash_id: { terms: { field: 'prhash_id.keyword', size: 10000 } } },
    }
    const pvResult = await queryIndex('nw_pageviews', pvQuery)
    for (const bucket of pvResult.aggregations.group_by_prhash_id.buckets) {
      pageviews[bucket.key] = bucket.doc_count
    }

    // Newsramp stats
    try {
      const nrQuery = {
        size: 0,
        query: { terms: { prhash_id: prhashIds } },
        aggs: { group_by_prhash_id: { terms: { field: 'prhash_id', size: 10000 } } },
      }
      const nrResult = await queryIndex('newsramp_stats', nrQuery)
      if (nrResult?.aggregations) {
        for (const bucket of nrResult.aggregations.group_by_prhash_id.buckets) {
          pageviews[bucket.key] = (pageviews[bucket.key] || 0) + bucket.doc_count
        }
      }
    } catch {
      // newsramp_stats index may not exist
    }

    // Shares from nw_shares (only with utm)
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
      aggs: { group_by_prhash_id: { terms: { field: 'prhash_id.keyword', size: 10000 } } },
    }
    const shResult = await queryIndex('nw_shares', shQuery)
    for (const bucket of shResult.aggregations.group_by_prhash_id.buckets) {
      shares[bucket.key] = bucket.doc_count
    }
  } catch (err) {
    console.error('OpenSearch getClipsTotalStats error:', err)
  }

  return { pageviews, shares }
}

type StatsInterval = 'hour' | 'day' | 'month'

/** Same buckets as the views and shares chart: hour for the first 3 days, then day, then month. */
function statsInterval(releasedAt: Date): StatsInterval {
  const now = new Date()
  const threeMonthsAgo = new Date(now)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const threeDaysAgo = new Date(now)
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  if (releasedAt < threeMonthsAgo) return 'month'
  if (releasedAt < threeDaysAgo) return 'day'
  return 'hour'
}

async function getClipStatistics(prhashId: string, releasedAt: Date) {
  const interval = statsInterval(releasedAt)
  const timeFormat = interval === 'month' ? 'MM/yyyy' : interval === 'day' ? 'MM/dd/yyyy' : 'MM/dd h:00 a'

  // Pageviews time series
  const pvQuery = {
    size: 0,
    query: { term: { 'prhash_id.keyword': prhashId } },
    aggs: { group_by: { date_histogram: { field: 'created_at', interval, format: timeFormat } } },
  }
  const pvResult = await queryIndex('nw_pageviews', pvQuery)
  const pvBuckets: any[] = pvResult.aggregations.group_by.buckets

  // Merge newsramp stats
  try {
    const nrQuery = {
      size: 0,
      query: { term: { prhash_id: prhashId } },
      aggs: { group_by: { date_histogram: { field: 'timestamp', interval, format: timeFormat } } },
    }
    const nrResult = await queryIndex('newsramp_stats', nrQuery)
    if (nrResult?.aggregations) {
      const pvByKey: Record<string, any> = {}
      for (const b of pvBuckets) pvByKey[b.key_as_string] = b
      for (const nr of nrResult.aggregations.group_by.buckets) {
        if (pvByKey[nr.key_as_string]) {
          pvByKey[nr.key_as_string].doc_count += nr.doc_count
        } else {
          pvBuckets.push(nr)
        }
      }
      pvBuckets.sort((a, b) => a.key - b.key)
    }
  } catch {
    // newsramp_stats may not exist
  }

  // Shares time series (only with utm)
  const shQuery = {
    size: 0,
    query: {
      bool: {
        must: [
          { term: { 'prhash_id.keyword': prhashId } },
          { exists: { field: 'utm' } },
        ],
      },
    },
    aggs: { group_by: { date_histogram: { field: 'created_at', interval, format: timeFormat } } },
  }
  const shResult = await queryIndex('nw_shares', shQuery)
  const shBuckets: any[] = shResult.aggregations.group_by.buckets

  // Build combined stats
  const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const combStats: TimeBucket[] = []
  const existingDates: Record<string, number> = {}
  let maxPv = 0
  let maxSh = 0

  for (const bucket of pvBuckets) {
    let label = bucket.key_as_string
    if (interval === 'month') {
      const parts = label.split('/')
      label = `${MONTH_NAMES[parseInt(parts[0])]} ${parts[1]}`
    }
    combStats.push({ key_as_string: label, views: bucket.doc_count, shares: 0 })
    existingDates[bucket.key_as_string] = bucket.doc_count
    maxPv = Math.max(maxPv, bucket.doc_count)
  }

  for (const bucket of shBuckets) {
    maxSh = Math.max(maxSh, bucket.doc_count)
    let label = bucket.key_as_string
    if (interval === 'month') {
      const parts = label.split('/')
      label = `${MONTH_NAMES[parseInt(parts[0])]} ${parts[1]}`
    }
    if (existingDates[bucket.key_as_string] !== undefined) {
      const existing = combStats.find((c) => c.key_as_string === label)
      if (existing) existing.shares = bucket.doc_count
    } else {
      combStats.push({ key_as_string: label, views: 0, shares: bucket.doc_count })
    }
  }

  const multiplier = maxSh > 0 && Math.floor(maxPv / maxSh / 2) > 1 ? Math.floor(maxPv / maxSh / 2) : 1

  // Cumulative growth
  const constGrowthStats: TimeBucket[] = []
  let totalViews = 0
  let totalShares = 0
  for (const c of combStats) {
    c.shares_multiplied = c.shares * multiplier
    totalViews += c.views
    totalShares += c.shares
    constGrowthStats.push({
      key_as_string: c.key_as_string,
      views: totalViews,
      shares: totalShares,
      shares_multiplied: totalShares * multiplier,
    })
  }

  return { combStats, constGrowthStats, multiplier }
}

async function getClipNewsrampReport(prhashId: string): Promise<any | false> {
  try {
    const url = `https://reports.newsramp.net/api_v1/9ba1d3d17c37f74d1d0d2377906e6ab3/${prhashId}/report.json`
    const res = await fetch(url)
    if (!res.ok) return false
    const json = await res.json()
    return json.news?.[0] || false
  } catch {
    return false
  }
}

async function getCircuitsForRelease(releaseId: number, releaseSlug: string | null, userId: number): Promise<CircuitsData> {
  // Get release category IDs
  const relCats = await db
    .select({ categoryId: releaseCategories.categoryId })
    .from(releaseCategories)
    .where(eq(releaseCategories.releaseId, releaseId))

  const catIds = relCats.map((rc) => rc.categoryId)

  const result: CircuitsData = {
    hr: CIRCUIT_CATEGORY_IDS.hr.some((id) => catIds.includes(id)),
    cannabis: CIRCUIT_CATEGORY_IDS.cannabis.some((id) => catIds.includes(id)),
    cannadelic: CIRCUIT_CATEGORY_IDS.cannadelic.some((id) => catIds.includes(id)),
    psychedelics: CIRCUIT_CATEGORY_IDS.psychedelics.some((id) => catIds.includes(id)),
    data: { reddit: false, hrtechfeed: false, weedweek: false },
  }

  // Check Reddit
  if (result.hr || result.cannabis || result.cannadelic || result.psychedelics) {
    const redditName = result.hr ? 'Reddit r/HRnews' : 'Reddit r/CannabisNewsInfo'
    const redditClips = await db
      .select()
      .from(clipReport)
      .where(and(eq(clipReport.releaseId, releaseId), eq(clipReport.network, 'reddit'), eq(clipReport.name, redditName)))
      .limit(1)
    if (redditClips.length > 0) {
      const c = redditClips[0]
      result.data.reddit = { id: c.id, name: c.name, network: c.network, city: c.city, state: c.state, logo: c.logo, link: c.link }
    }
  }

  // Check HRTechFeed
  if (result.hr && releaseSlug) {
    const hrtechfeedLink = `https://hrtechfeed.com/${releaseSlug}`
    try {
      const res = await fetch(hrtechfeedLink, { method: 'HEAD' })
      if (res.ok) {
        result.data.hrtechfeed = { link: hrtechfeedLink }
      }
    } catch {
      // not available
    }
  }

  // Check WeedWeek (partner_id=1)
  if (result.cannabis || result.cannadelic || result.psychedelics) {
    const user = await db
      .select({ partnerId: users.partnerId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    result.data.weedweek = user.length > 0 && user[0].partnerId === 1
  }

  return result
}

// --- Crawler / AI visibility ---

/**
 * AI bots that fetch pages live to answer a user's question (grounding /
 * retrieval). Everything else classified as `ai` by the website is treated as
 * a training / dataset crawler. Names match apps/website/lib/classify-user-agent.ts.
 */
const AI_GROUNDING_BOTS = new Set([
  'ChatGPT-User',
  'OAI-SearchBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'YouBot',
  'Google-CloudVertexBot',
  'Firecrawl',
])

export const GROUNDING_SOURCE_LABELS: Record<string, string> = {
  google_ai_overview: 'Google AI Overview',
  openai: 'ChatGPT Search',
  perplexity: 'Perplexity',
}

export function groundingSourceLabel(source: string): string {
  return GROUNDING_SOURCE_LABELS[source] || source
}

function emptyCrawlerGroup(): CrawlerGroup {
  return { total: 0, bots: [], firstSeen: null, lastSeen: null }
}

function addToGroup(group: CrawlerGroup, stat: CrawlerBotStat) {
  group.total += stat.hits
  group.bots.push(stat)
  if (stat.firstSeen && (!group.firstSeen || stat.firstSeen < group.firstSeen)) group.firstSeen = stat.firstSeen
  if (stat.lastSeen && (!group.lastSeen || stat.lastSeen > group.lastSeen)) group.lastSeen = stat.lastSeen
}

const ACTIVITY_MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** 'YYYY-MM-DD HH24' (UTC) -> 'MM/dd h:00 a', matching the OpenSearch hour histogram. */
function hourChartLabel(stamp: string): string {
  const match = stamp.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2})$/)
  if (!match) return stamp
  const hour24 = Number(match[4])
  const h12 = hour24 % 12 || 12
  const ampm = hour24 < 12 ? 'AM' : 'PM'
  return `${match[2]}/${match[3]} ${h12}:00 ${ampm}`
}

function activityFromDaily(daily: CrawlerDailyBucket[], interval: 'day' | 'month'): CrawlerActivityBucket[] {
  if (interval === 'day') {
    return daily.map((bucket) => {
      const [y, m, d] = bucket.date.split('-')
      return {
        label: `${m}/${d}/${y}`,
        aiTraining: bucket.aiTraining,
        aiGrounding: bucket.aiGrounding,
        seo: bucket.seo,
      }
    })
  }
  const byMonth = new Map<string, CrawlerActivityBucket>()
  for (const bucket of daily) {
    const [y, m] = bucket.date.split('-')
    const label = `${ACTIVITY_MONTHS[Number(m)] || m} ${y}`
    const current = byMonth.get(label) ?? { label, aiTraining: 0, aiGrounding: 0, seo: 0 }
    current.aiTraining += bucket.aiTraining
    current.aiGrounding += bucket.aiGrounding
    current.seo += bucket.seo
    byMonth.set(label, current)
  }
  return Array.from(byMonth.values())
}

async function hourlyCrawlerActivity(releaseId: number): Promise<CrawlerActivityBucket[]> {
  // page_hits.created_at is a timestamp. Truncate in UTC so the label matches the chart.
  const bucket = sql<string>`to_char((date_trunc('hour', (${pageHits.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')), 'YYYY-MM-DD HH24')`
  const rows = await db
    .select({
      bucket,
      visitor: pageHits.visitor,
      botName: pageHits.botName,
      hits: count(),
    })
    .from(pageHits)
    .where(and(eq(pageHits.prId, releaseId), inArray(pageHits.visitor, ['ai', 'seo'])))
    .groupBy(bucket, pageHits.visitor, pageHits.botName)
    .orderBy(asc(bucket))

  const byHour = new Map<string, CrawlerActivityBucket>()
  for (const row of rows) {
    const label = hourChartLabel(row.bucket)
    const current = byHour.get(label) ?? { label, aiTraining: 0, aiGrounding: 0, seo: 0 }
    const n = Number(row.hits)
    if (row.visitor === 'seo') current.seo += n
    else if (row.botName && AI_GROUNDING_BOTS.has(row.botName)) current.aiGrounding += n
    else current.aiTraining += n
    byHour.set(label, current)
  }
  return Array.from(byHour.values())
}

async function getCrawlerStats(releaseId: number, releasedAt: Date | null): Promise<CrawlerStats> {
  const stats: CrawlerStats = {
    aiTraining: emptyCrawlerGroup(),
    aiGrounding: emptyCrawlerGroup(),
    seo: emptyCrawlerGroup(),
    daily: [],
    activity: [],
  }

  try {
    const rows = await db
      .select({
        visitor: pageHits.visitor,
        botName: pageHits.botName,
        hits: count(),
        firstSeen: min(pageHits.createdAt),
        lastSeen: max(pageHits.createdAt),
      })
      .from(pageHits)
      .where(and(eq(pageHits.prId, releaseId), inArray(pageHits.visitor, ['ai', 'seo'])))
      .groupBy(pageHits.visitor, pageHits.botName)
      .orderBy(desc(count()))

    for (const row of rows) {
      const stat: CrawlerBotStat = {
        botName: row.botName || (row.visitor === 'ai' ? 'Unknown AI bot' : 'Unknown crawler'),
        hits: Number(row.hits),
        firstSeen: row.firstSeen ? new Date(row.firstSeen).toISOString() : null,
        lastSeen: row.lastSeen ? new Date(row.lastSeen).toISOString() : null,
      }
      if (row.visitor === 'seo') {
        addToGroup(stats.seo, stat)
      } else if (row.botName && AI_GROUNDING_BOTS.has(row.botName)) {
        addToGroup(stats.aiGrounding, stat)
      } else {
        addToGroup(stats.aiTraining, stat)
      }
    }

    // Daily series (UTC), one row per (day, visitor, bot) so we can bucket
    // AI hits into training vs grounding
    const day = sql<string>`to_char(date_trunc('day', ${pageHits.createdAt}), 'YYYY-MM-DD')`
    const dailyRows = await db
      .select({
        date: day,
        visitor: pageHits.visitor,
        botName: pageHits.botName,
        hits: count(),
      })
      .from(pageHits)
      .where(and(eq(pageHits.prId, releaseId), inArray(pageHits.visitor, ['ai', 'seo'])))
      .groupBy(day, pageHits.visitor, pageHits.botName)
      .orderBy(asc(day))

    const byDate = new Map<string, CrawlerDailyBucket>()
    for (const row of dailyRows) {
      let bucket = byDate.get(row.date)
      if (!bucket) {
        bucket = { date: row.date, aiTraining: 0, aiGrounding: 0, seo: 0 }
        byDate.set(row.date, bucket)
      }
      const n = Number(row.hits)
      if (row.visitor === 'seo') bucket.seo += n
      else if (row.botName && AI_GROUNDING_BOTS.has(row.botName)) bucket.aiGrounding += n
      else bucket.aiTraining += n
    }
    stats.daily = Array.from(byDate.values())
    const interval = releasedAt ? statsInterval(releasedAt) : 'day'
    stats.activity = interval === 'hour'
      ? await hourlyCrawlerActivity(releaseId)
      : activityFromDaily(stats.daily, interval)
  } catch (err) {
    // page_hits may not exist yet in every environment; the report must still render
    console.error('getCrawlerStats error:', err)
  }

  return stats
}

async function getAiGrounding(releaseId: number): Promise<AiGroundingData> {
  const result: AiGroundingData = { citations: [], sources: [] }
  try {
    const rows = await db
      .select({
        source: releaseGrounding.groundingSource,
        query: releaseGrounding.groundingQuery,
        createdAt: releaseGrounding.createdAt,
      })
      .from(releaseGrounding)
      .where(eq(releaseGrounding.prId, releaseId))
      .orderBy(desc(releaseGrounding.createdAt))

    const sources = new Set<string>()
    for (const row of rows) {
      sources.add(row.source)
      result.citations.push({
        source: row.source,
        sourceLabel: groundingSourceLabel(row.source),
        query: row.query,
        createdAt: row.createdAt.toISOString(),
      })
    }
    result.sources = Array.from(sources)
  } catch (err) {
    console.error('getAiGrounding error:', err)
  }
  return result
}

export function reportReady(releasedAt: Date | null): boolean {
  if (!releasedAt) return false
  return Date.now() - releasedAt.getTime() > 24 * 60 * 60 * 1000
}

// --- Main report data orchestrator ---

export async function getReportData(uuid: string, refresh = false): Promise<ReportData | null> {
  // Check cache
  if (!refresh) {
    const cached = reportCache.get(uuid)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      // Always refresh pdfDownloadCount from DB (cheap query, should be live)
      try {
        const rel = await db.query.releases.findFirst({
          columns: { id: true },
          where: eq(releases.uuid, uuid),
        })
        if (rel) {
          const pdfCountResult = await db
            .select({ value: count() })
            .from(pdfDownloads)
            .where(eq(pdfDownloads.releaseId, rel.id))
          cached.data.pdfDownloadCount = Number(pdfCountResult[0]?.value ?? 0)
        }
      } catch {
        // non-critical
      }
      return cached.data
    }
  }

  // Get release with company
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    with: { company: true },
  })

  if (!release || release.status !== 'sent') return null

  // Get clips by network
  const allClips = await db
    .select()
    .from(clipReport)
    .where(eq(clipReport.releaseId, release.id))

  const toClipRecord = (c: typeof allClips[0]): ClipRecord => ({
    id: c.id, name: c.name, network: c.network, city: c.city, state: c.state, logo: c.logo, link: c.link,
  })

  const synacor = allClips.filter((c) => c.network === 'synacor').map(toClipRecord)
  const gomedia = allClips.filter((c) => c.network === 'gomedia').map(toClipRecord)
  const fcmarkets = allClips.filter((c) => c.network === 'fc-markets').map(toClipRecord)
  const marketminute = allClips.filter((c) => c.network === 'marketminute').map(toClipRecord)
  const redditNPClip = allClips.find((c) => c.network === 'reddit' && c.name === 'Reddit r/NewsworthyAlerts')
  const streetinsider = allClips.find((c) => c.network === 'streetinsider')

  // OpenSearch stats
  let totalPv = 0
  let totalSh = 0
  let combStats: TimeBucket[] = []
  let constGrowthStats: TimeBucket[] = []
  let shStatsMultiplier = 1

  if (release.prhashId) {
    const { pageviews, shares } = await getClipsTotalStats([release.prhashId])
    totalPv = pageviews[release.prhashId] || 0
    totalSh = shares[release.prhashId] || 0

    if (release.releasedAt) {
      const stats = await getClipStatistics(release.prhashId, release.releasedAt)
      combStats = stats.combStats
      constGrowthStats = stats.constGrowthStats
      shStatsMultiplier = stats.multiplier
    }
  }

  // Newsramp report (needed before totals so LinkedIn impressions roll into views)
  const nwrampReport = release.prhashId ? await getClipNewsrampReport(release.prhashId) : false
  if (nwrampReport && nwrampReport.placements) {
    for (const p of nwrampReport.placements) {
      if (!p.logo) p.logo = ''
    }
  }

  const linkedinImpressions = Number(
    nwrampReport?.linkedin_analytics?.impressions || 0
  )
  if (linkedinImpressions > 0) {
    totalPv += linkedinImpressions
  }

  // eCPC (views include LinkedIn impressions when available)
  let ecpc = '0.00'
  if (totalPv + totalSh > 0) {
    const val = Math.floor((129 / (totalPv + totalSh)) * 100) / 100
    ecpc = val.toFixed(2)
  }

  // Enhanced distribution
  const enhanced = await db
    .select()
    .from(releaseEnhanced)
    .where(eq(releaseEnhanced.prid, release.id))
    .limit(1)

  let yahooFinanceUrls: string[] = []
  let enhancedPublications: EnhancedPublication[] = []

  if (enhanced.length > 0 && enhanced[0].reportJson) {
    const reportData = enhanced[0].reportJson as Record<string, any>
    const yahooUrls: string[] = reportData.stats?.yahoo_urls || []

    const yahooFinanceOnly = yahooUrls.filter(
      (u) => u.includes('finance.yahoo.com') && !u.includes('ca.finance.yahoo.com')
    )
    if (yahooFinanceOnly.length > 0) {
      yahooFinanceUrls = yahooFinanceOnly
    } else if (yahooUrls.length === 1) {
      yahooFinanceUrls = yahooUrls
    }

  }

  const targetPlacements = await db
    .select()
    .from(releasePlacements)
    .where(and(
      eq(releasePlacements.prid, release.id),
      eq(releasePlacements.isTarget, true),
    ))

  for (const p of targetPlacements) {
    let logoUrl = p.imageUrl || ''
    if (logoUrl) {
      if (logoUrl.startsWith('http')) {
        // keep as-is
      } else if (logoUrl.startsWith('/')) {
        logoUrl = `https://cdn1.newsworthy.ai${logoUrl.replace('/images/clip_report/', '/images/clipreport/')}`
      } else {
        logoUrl = `https://cdn1.newsworthy.ai/images/clipreport/${logoUrl}`
      }
    }
    enhancedPublications.push({ name: p.name || '', link: p.link || '', logo_url: logoUrl })
  }

  // Circuits
  const circuitsData = await getCircuitsForRelease(release.id, release.slug, release.userId)

  // Advocacy
  const opts = await db
    .select()
    .from(releaseOptions)
    .where(eq(releaseOptions.prId, release.id))
    .limit(1)
  const hasAdvGroup = opts.length > 0 && opts[0].advocacy === true

  // Share list size (active advocate contacts) for the brand
  const [shareListRow] = await db
    .select({ value: count() })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, release.companyId),
      inArray(crmContacts.contactType, ['advocate', 'both']),
      sql`${crmContacts.isDeleted} IS NOT TRUE`,
      sql`${crmContacts.unsubscribeAt} IS NULL`,
      sql`${crmContacts.bouncedAt} IS NULL`,
    ))
  const shareListCount = Number(shareListRow?.value ?? 0)

  // Release age
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  const releaseIsYearOld = release.releasedAt ? release.releasedAt <= oneYearAgo : false

  // PDF download count
  let pdfDownloadCount = 0
  try {
    const pdfCountResult = await db
      .select({ value: count() })
      .from(pdfDownloads)
      .where(eq(pdfDownloads.releaseId, release.id))
    pdfDownloadCount = Number(pdfCountResult[0]?.value ?? 0)
  } catch {
    // table may not exist yet
  }

  // Crawler traffic (AI training / AI grounding / SEO) and confirmed AI citations
  const [crawlerStats, aiGrounding] = await Promise.all([
    getCrawlerStats(release.id, release.releasedAt),
    getAiGrounding(release.id),
  ])

  const encodedTitle = encodeURIComponent(`"${release.title || ''}"`)

  const data: ReportData = {
    release: {
      id: release.id,
      uuid: release.uuid,
      title: release.title,
      abstract: release.abstract,
      slug: release.slug,
      location: release.location,
      releasedAt: release.releasedAt?.toISOString() || null,
      releaseAt: release.releaseAt?.toISOString() || null,
      prhashId: release.prhashId,
      status: release.status,
      score: release.score,
    },
    company: {
      id: release.company.id,
      uuid: release.company.uuid,
      companyName: release.company.companyName,
      logoUrl: release.company.logoUrl,
    },
    clips: {
      synacor,
      gomedia,
      fcmarkets,
      marketminute,
      redditNP: redditNPClip ? toClipRecord(redditNPClip) : null,
      streetinsiderUrl: streetinsider?.link || null,
    },
    totalPv,
    totalSh,
    ecpc,
    combStats,
    constGrowthStats,
    shStatsMultiplier,
    releaseIsYearOld,
    hasAdvGroup,
    shareListCount,
    nwrampReport,
    enhancedPublications,
    yahooFinanceUrls,
    circuits: circuitsData,
    pdfDownloadCount,
    crawlerStats,
    aiGrounding,
    encodedTitle,
    fetchedAt: new Date().toISOString(),
  }

  // Store in cache
  reportCache.set(uuid, { data, fetchedAt: Date.now() })

  return data
}
