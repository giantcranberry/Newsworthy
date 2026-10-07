/**
 * Refresh blog feeds and generate press releases from new posts.
 *
 * Designed for hourly cron. Idempotent: posts are deduped by (feed_id, guid),
 * and pending posts are claimed via atomic UPDATE so concurrent workers
 * cannot double-process.
 *
 * Usage:
 *   doppler run -- bun scripts/refresh-blog-feeds.ts
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --limit=10
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --feed-id=123
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --refresh-only
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --no-pr
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --test=<post-id-or-uuid>
 *   doppler run -- bun scripts/refresh-blog-feeds.ts --test=<id> --ignore-gates
 *
 * Eligibility gates (RSS refresh and PR generation):
 *   - Feed must be >= 60 minutes old.
 *   - Feed's company must have effective blog_pr credits > 0, where
 *     effective = SUM(active credits) - count of blog-sourced drafts
 *     awaiting finalize (status in start/draft/draftnxt).
 *   When the credit gate fails, the owner is notified (24h cooldown).
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, or, asc, sql, isNull, gt, lte, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import * as schema from '../src/db/schema'
import { parseBlogFeed } from '../src/lib/blogs/parse-feed'
import { generatePressReleaseFromPost } from '../src/lib/blogs/generate-pr'
import { dispatchFundingNeededNotification } from '../src/lib/blogs/notify'

const DATABASE_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DIRECT_DATABASE_URL or DATABASE_URL is required')
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const exact = args.find((a) => a === `--${name}`)
  if (exact) return ''
  const eqArg = args.find((a) => a.startsWith(`--${name}=`))
  return eqArg ? eqArg.split('=', 2)[1] : undefined
}
const flagPresent = (name: string) => args.includes(`--${name}`)

const limitArg = flag('limit')
const limit = limitArg ? parseInt(limitArg, 10) : 5
const feedIdArg = flag('feed-id')
const onlyFeedId = feedIdArg ? parseInt(feedIdArg, 10) : null
const refreshOnly = flagPresent('refresh-only')
const testTarget = flag('test')
const skipPrGeneration = flagPresent('no-pr')
const ignoreGates = flagPresent('ignore-gates')

const usesPgBouncer = DATABASE_URL.includes('pgbouncer=true')
const client = postgres(DATABASE_URL, {
  prepare: usesPgBouncer ? false : undefined,
  max: 1,
})
const db = drizzle(client, { schema })

const { blogFeeds, blogPosts, brandCredits, releases } = schema

const BLOG_CREDIT_PRODUCT_TYPE = 'blog_pr'
const FEED_AGE_GRACE_MS = 60 * 60 * 1000
const FUNDING_WARNING_COOLDOWN_MS = 24 * 60 * 60 * 1000
const PENDING_DRAFT_STATUSES = ['start', 'draft', 'draftnxt']

function log(scope: string, msg: string) {
  console.log(`[${new Date().toISOString()}] ${scope.padEnd(10)} ${msg}`)
}

async function evaluateFeedEligibility(): Promise<{ eligibleIds: Set<number>; warnedCount: number }> {
  const now = new Date()
  const ageCutoff = new Date(now.getTime() - FEED_AGE_GRACE_MS)
  const cooldownCutoff = new Date(now.getTime() - FUNDING_WARNING_COOLDOWN_MS)

  const feeds = await db
    .select()
    .from(blogFeeds)
    .where(and(eq(blogFeeds.isDeleted, false), eq(blogFeeds.isActive, true), lte(blogFeeds.createdAt, ageCutoff)))

  if (feeds.length === 0) return { eligibleIds: new Set(), warnedCount: 0 }

  const companyIds = Array.from(new Set(feeds.map((f) => f.companyId)))

  const creditRows = await db
    .select({
      companyId: brandCredits.companyId,
      total: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)::int`,
    })
    .from(brandCredits)
    .where(
      and(
        inArray(brandCredits.companyId, companyIds),
        eq(brandCredits.productType, BLOG_CREDIT_PRODUCT_TYPE),
        or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
      ),
    )
    .groupBy(brandCredits.companyId)

  const creditMap = new Map(
    creditRows
      .filter((r): r is { companyId: number; total: number } => r.companyId != null)
      .map((r) => [r.companyId, r.total]),
  )

  const draftRows = await db
    .select({
      companyId: releases.companyId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(releases)
    .innerJoin(blogPosts, eq(blogPosts.releaseId, releases.id))
    .where(
      and(
        inArray(releases.companyId, companyIds),
        inArray(releases.status, PENDING_DRAFT_STATUSES),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
      ),
    )
    .groupBy(releases.companyId)
  const draftMap = new Map(draftRows.map((r) => [r.companyId, r.count]))

  const eligibleIds = new Set<number>()
  let warnedCount = 0

  for (const feed of feeds) {
    const credits = creditMap.get(feed.companyId) ?? 0
    const pending = draftMap.get(feed.companyId) ?? 0
    const effective = credits - pending

    if (effective > 0) {
      eligibleIds.add(feed.id)
      if (feed.fundingWarningSentAt) {
        await db
          .update(blogFeeds)
          .set({ fundingWarningSentAt: null, updatedAt: new Date() })
          .where(eq(blogFeeds.id, feed.id))
      }
      continue
    }

    const alreadyWarnedRecently =
      feed.fundingWarningSentAt != null && feed.fundingWarningSentAt > cooldownCutoff
    if (alreadyWarnedRecently) continue

    try {
      await dispatchFundingNeededNotification({
        feed: {
          uuid: feed.uuid,
          title: feed.title,
          notifyEmail: feed.notifyEmail,
          notifyEmailTo: feed.notifyEmailTo,
          notifySms: feed.notifySms,
          notifySmsPhone: feed.notifySmsPhone,
          notifySlack: feed.notifySlack,
          notifySlackWebhookUrl: feed.notifySlackWebhookUrl,
        },
        credits,
        pendingDrafts: pending,
      })
      await db
        .update(blogFeeds)
        .set({ fundingWarningSentAt: new Date(), updatedAt: new Date() })
        .where(eq(blogFeeds.id, feed.id))
      warnedCount++
      log('gate', `funding warning sent for feed ${feed.id} (credits=${credits}, pending=${pending})`)
    } catch (err) {
      log('gate', `funding warning failed for feed ${feed.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { eligibleIds, warnedCount }
}

async function refreshFeed(feed: typeof blogFeeds.$inferSelect) {
  log('refresh', `feed ${feed.id} "${feed.title || feed.feedUrl}"`)
  try {
    const parsed = await parseBlogFeed(feed.feedUrl)
    let newPosts = 0
    for (const post of parsed.posts) {
      const inserted = await db
        .insert(blogPosts)
        .values({
          uuid: uuidv4(),
          feedId: feed.id,
          guid: post.guid.slice(0, 512),
          title: post.title?.slice(0, 512),
          summary: post.summary,
          content: post.content,
          imageUrl: post.imageUrl,
          author: post.author?.slice(0, 255),
          link: post.link,
          publishedAt: post.publishedAt ?? null,
        })
        .onConflictDoNothing({ target: [blogPosts.feedId, blogPosts.guid] })
        .returning({ id: blogPosts.id })
      if (inserted.length > 0) newPosts++
    }

    const lastPostAt = parsed.posts
      .map((p) => p.publishedAt)
      .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    await db
      .update(blogFeeds)
      .set({
        title: parsed.title.slice(0, 255),
        description: parsed.description ?? null,
        imageUrl: parsed.imageUrl ?? null,
        author: parsed.author?.slice(0, 255) ?? null,
        language: parsed.language?.slice(0, 16) ?? null,
        link: parsed.link ?? null,
        category: parsed.category?.slice(0, 128) ?? null,
        lastFetchedAt: new Date(),
        lastPostPublishedAt: lastPostAt ?? feed.lastPostPublishedAt,
        fetchError: null,
        updatedAt: new Date(),
      })
      .where(eq(blogFeeds.id, feed.id))

    log('refresh', `  ${parsed.posts.length} items in feed, ${newPosts} new`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log('refresh', `  FAILED: ${msg}`)
    await db
      .update(blogFeeds)
      .set({ lastFetchedAt: new Date(), fetchError: msg.slice(0, 2000), updatedAt: new Date() })
      .where(eq(blogFeeds.id, feed.id))
  }
}

async function refreshAllFeeds(eligibleFeedIds: Set<number>) {
  const conditions = [eq(blogFeeds.isDeleted, false), eq(blogFeeds.isActive, true)]
  if (onlyFeedId) conditions.push(eq(blogFeeds.id, onlyFeedId))
  const feeds = await db.query.blogFeeds.findMany({
    where: and(...conditions),
    orderBy: asc(blogFeeds.lastFetchedAt),
  })
  const eligible = feeds.filter((f) => eligibleFeedIds.has(f.id))
  log('refresh', `${eligible.length} feed(s) to refresh`)
  for (const feed of eligible) await refreshFeed(feed)
}

async function markFailed(postId: number, error: string) {
  await db
    .update(blogPosts)
    .set({
      generationStatus: 'failed',
      generationError: error.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, postId))
}

async function markCompleted(postId: number) {
  await db
    .update(blogPosts)
    .set({
      generationStatus: 'completed',
      generationError: null,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, postId))
}

async function generateForPost(postId: number) {
  const result = await generatePressReleaseFromPost(postId)
  if (result.status === 'created' || result.status === 'already-exists') {
    await markCompleted(postId)
    log('pr', `  post ${postId} ${result.status} release=${result.releaseId ?? ''}`)
    return
  }
  await markFailed(postId, result.error || result.status)
  log('pr', `  post ${postId} FAILED: ${result.error || result.status}`)
}

async function generatePending(eligibleFeedIds: Set<number>) {
  if (skipPrGeneration) {
    log('pr', 'skipped (--no-pr)')
    return
  }
  if (eligibleFeedIds.size === 0) {
    log('pr', 'no eligible feeds')
    return
  }

  const candidates = await db
    .select({ id: blogPosts.id, title: blogPosts.title })
    .from(blogPosts)
    .innerJoin(blogFeeds, eq(blogFeeds.id, blogPosts.feedId))
    .where(
      and(
        eq(blogFeeds.isDeleted, false),
        eq(blogFeeds.isActive, true),
        eq(blogPosts.skip, false),
        eq(blogPosts.generationStatus, 'pending'),
        isNull(blogPosts.releaseId),
        inArray(blogPosts.feedId, Array.from(eligibleFeedIds)),
        onlyFeedId ? eq(blogPosts.feedId, onlyFeedId) : sql`true`,
      ),
    )
    .orderBy(sql`${blogPosts.publishedAt} desc nulls last`, asc(blogPosts.id))
    .limit(limit)

  log('pr', `${candidates.length} pending post(s) (limit=${limit})`)
  for (const post of candidates) {
    const claimed = await db
      .update(blogPosts)
      .set({ generationStatus: 'processing', updatedAt: new Date() })
      .where(and(eq(blogPosts.id, post.id), eq(blogPosts.generationStatus, 'pending'), eq(blogPosts.skip, false)))
      .returning({ id: blogPosts.id })
    if (claimed.length === 0) continue
    log('pr', `post ${post.id} "${post.title?.slice(0, 60) || '(no title)'}"`)
    try {
      await generateForPost(post.id)
    } catch (err) {
      await markFailed(post.id, err instanceof Error ? err.message : String(err))
    }
  }
}

async function runTest(target: string, eligibleIds: Set<number>) {
  const numeric = /^\d+$/.test(target)
  const post = await db.query.blogPosts.findFirst({
    where: numeric ? eq(blogPosts.id, parseInt(target, 10)) : eq(blogPosts.uuid, target),
  })
  if (!post) {
    console.error(`Post not found: ${target}`)
    process.exit(1)
  }
  if (!ignoreGates && !eligibleIds.has(post.feedId)) {
    console.error(`Feed ${post.feedId} is not eligible (too new or no blog_pr credits). Pass --ignore-gates to bypass.`)
    process.exit(1)
  }
  if (post.releaseId && !skipPrGeneration) {
    log('test', `post ${post.id} already has release ${post.releaseId}`)
    return
  }
  await db
    .update(blogPosts)
    .set({ generationStatus: 'processing', generationError: null, updatedAt: new Date() })
    .where(eq(blogPosts.id, post.id))
  await generateForPost(post.id)
}

async function main() {
  const { eligibleIds, warnedCount } = ignoreGates
    ? { eligibleIds: new Set<number>(), warnedCount: 0 }
    : await evaluateFeedEligibility()

  if (ignoreGates && onlyFeedId) eligibleIds.add(onlyFeedId)

  log('gate', `${eligibleIds.size} eligible feed(s), ${warnedCount} funding warning(s)`)

  if (testTarget) {
    if (ignoreGates) {
      const numeric = /^\d+$/.test(testTarget)
      const post = await db.query.blogPosts.findFirst({
        where: numeric ? eq(blogPosts.id, parseInt(testTarget, 10)) : eq(blogPosts.uuid, testTarget),
        columns: { feedId: true },
      })
      if (post) eligibleIds.add(post.feedId)
    }
    await runTest(testTarget, eligibleIds)
    await client.end()
    return
  }

  await refreshAllFeeds(eligibleIds)
  if (!refreshOnly) await generatePending(eligibleIds)
  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end()
  process.exit(1)
})
