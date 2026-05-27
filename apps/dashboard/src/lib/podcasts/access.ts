import { db } from '@/db'
import { podcastFeeds, podcastEpisodes, company, brandCredits } from '@/db/schema'
import { eq, and, inArray, desc, sql, gt, isNull, or } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

const PODCAST_PRODUCT_TYPE = 'podcast_pr'

export interface PodcastCreditSummary {
  totalCredits: number
  earliestExpiresAt: Date | null
  batches: Array<{
    id: number
    credits: number
    expiresAt: Date | null
    createdAt: Date
  }>
}

export async function getPodcastCreditsForCompany(companyId: number): Promise<PodcastCreditSummary> {
  const now = new Date()
  const rows = await db
    .select({
      id: brandCredits.id,
      credits: brandCredits.credits,
      expiresAt: brandCredits.expiresAt,
      createdAt: brandCredits.createdAt,
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.companyId, companyId),
        eq(brandCredits.productType, PODCAST_PRODUCT_TYPE),
        or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
      ),
    )
    .orderBy(brandCredits.expiresAt, brandCredits.createdAt)

  const totalCredits = rows.reduce((sum, r) => sum + (r.credits || 0), 0)
  const withExpiry = rows.filter((r) => r.expiresAt != null)
  const earliestExpiresAt = withExpiry.length > 0 ? (withExpiry[0].expiresAt as Date) : null

  return { totalCredits, earliestExpiresAt, batches: rows }
}

export async function getUserFeeds(userId: number) {
  const companyIds = await getUserCompanyIds(userId)
  if (companyIds.length === 0) return []

  const feeds = await db.query.podcastFeeds.findMany({
    where: and(
      inArray(podcastFeeds.companyId, companyIds),
      eq(podcastFeeds.isDeleted, false),
    ),
    with: { company: { columns: { id: true, uuid: true, companyName: true } } },
    orderBy: desc(podcastFeeds.createdAt),
  })

  if (feeds.length === 0) return []

  const feedIds = feeds.map((f) => f.id)
  const feedCompanyIds = Array.from(new Set(feeds.map((f) => f.companyId)))
  const now = new Date()

  const [counts, creditRows] = await Promise.all([
    db
      .select({
        feedId: podcastEpisodes.feedId,
        total: sql<number>`count(*)::int`,
        skipped: sql<number>`sum(case when ${podcastEpisodes.skip} then 1 else 0 end)::int`,
      })
      .from(podcastEpisodes)
      .where(inArray(podcastEpisodes.feedId, feedIds))
      .groupBy(podcastEpisodes.feedId),
    db
      .select({
        companyId: brandCredits.companyId,
        total: sql<number>`coalesce(sum(${brandCredits.credits}), 0)::int`,
      })
      .from(brandCredits)
      .where(
        and(
          inArray(brandCredits.companyId, feedCompanyIds),
          eq(brandCredits.productType, PODCAST_PRODUCT_TYPE),
          or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
        ),
      )
      .groupBy(brandCredits.companyId),
  ])

  const countMap = new Map(counts.map((c) => [c.feedId, c]))
  const creditMap = new Map(creditRows.map((r) => [r.companyId, r.total ?? 0]))

  return feeds.map((f) => ({
    ...f,
    episodeCount: countMap.get(f.id)?.total ?? 0,
    skippedCount: countMap.get(f.id)?.skipped ?? 0,
    credits: creditMap.get(f.companyId) ?? 0,
  }))
}

export async function getUserFeedByUuid(userId: number, feedUuid: string) {
  const feed = await db.query.podcastFeeds.findFirst({
    where: and(eq(podcastFeeds.uuid, feedUuid), eq(podcastFeeds.isDeleted, false)),
    with: { company: { columns: { id: true, uuid: true, companyName: true } } },
  })
  if (!feed) return null

  const allowedCompanyIds = await getUserCompanyIds(userId)
  if (!allowedCompanyIds.includes(feed.companyId)) return null

  return feed
}

export async function getFeedEpisodes(feedId: number) {
  return db.query.podcastEpisodes.findMany({
    where: eq(podcastEpisodes.feedId, feedId),
    orderBy: [desc(podcastEpisodes.publishedAt), desc(podcastEpisodes.id)],
    with: {
      release: { columns: { uuid: true, status: true } },
    },
  })
}

export async function getBrandsAvailableForFeed(userId: number) {
  const companyIds = await getUserCompanyIds(userId, 'collaborator')
  if (companyIds.length === 0) return []

  const brands = await db
    .select({ id: company.id, uuid: company.uuid, name: company.companyName })
    .from(company)
    .where(and(inArray(company.id, companyIds), eq(company.isDeleted, false)))

  const existing = await db
    .select({ companyId: podcastFeeds.companyId })
    .from(podcastFeeds)
    .where(and(inArray(podcastFeeds.companyId, companyIds), eq(podcastFeeds.isDeleted, false)))

  const taken = new Set(existing.map((e) => e.companyId))
  return brands.filter((b) => !taken.has(b.id)).sort((a, b) => a.name.localeCompare(b.name))
}
