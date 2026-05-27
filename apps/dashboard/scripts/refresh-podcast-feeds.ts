/**
 * Refresh podcast feeds + transcribe new episodes.
 *
 * Designed for hourly cron. Idempotent: episodes are deduped by (feed_id, guid),
 * and pending episodes are claimed via atomic UPDATE so concurrent workers
 * cannot double-process.
 *
 * Usage:
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --limit=10
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --feed-id=123
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --refresh-only
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --transcribe-only
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --test=<episode-id-or-uuid>
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --test=<id> --force-transcribe
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --list      # show recent episode IDs/UUIDs
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --no-pr     # skip press release generation
 *   doppler run -- bun scripts/refresh-podcast-feeds.ts --test=<id> --ignore-gates  # dev: bypass age/credit gate
 *
 * Eligibility gates (applied to RSS refresh, transcription, and PR backfill):
 *   - Feed must be >= 60 minutes old (createdAt). Gives users time to
 *     configure brand parameters and fund podcast_pr credits before anything
 *     runs against their feed.
 *   - Feed's company must have *effective* podcast_pr credits > 0, where
 *     effective = SUM(active credits) - count of podcast-sourced drafts
 *     awaiting finalize (status in start/draft/draftnxt). Each pending draft
 *     is an unrealized obligation; generating more drafts on top would
 *     oversubscribe the balance. Example: 3 credits + 3 pending drafts = 0
 *     effective; need 4+ credits before draft #4 will generate.
 *   When the effective-credit gate fails, the feed owner is notified via
 *   email/SMS/Slack (per feed preferences) that the account needs funding,
 *   with a 24h cooldown tracked by podcast_feeds.funding_warning_sent_at.
 *   In --test mode the gates also apply unless --ignore-gates is set.
 *
 * --test mode: process exactly one episode. If a transcript already exists
 * and no release has been generated yet, only the PR generation runs —
 * AssemblyAI is NOT called again. Pass --force-transcribe to redownload
 * and re-transcribe regardless.
 *
 * The scheduled flow also runs a "PR backfill" pass after transcription so
 * episodes with a completed transcript but no release (e.g. because PR
 * generation crashed) get retried on the next tick without re-transcribing.
 *
 * Required env (Doppler):
 *   DIRECT_DATABASE_URL or DATABASE_URL
 *   LINODES3_*  (for audio archival)
 *   ASSEMBLYAI_API_KEY  (for speaker-labeled transcription)
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, or, asc, sql, isNull, gt, lte, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import * as schema from '../src/db/schema'
import { parsePodcastFeed } from '../src/lib/podcasts/parse-feed'
import { uploadPodcastAudio } from '../src/services/s3'
import { generatePressReleaseFromEpisode } from '../src/lib/podcasts/generate-pr'
import { dispatchFundingNeededNotification } from '../src/lib/podcasts/notify'

const DATABASE_URL = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DIRECT_DATABASE_URL or DATABASE_URL is required')
  process.exit(1)
}

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY
const ASSEMBLYAI_ENDPOINT = 'https://api.assemblyai.com/v2/transcript'
const POLL_INTERVAL_MS = 5000
const TRANSCRIBE_TIMEOUT_MS = 30 * 60 * 1000 // 30 min hard cap
const MAX_AUDIO_BYTES = 500 * 1024 * 1024 // 500 MB
const DEFAULT_LIMIT = 5

// ----- CLI flags ---------------------------------------------------------
const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const exact = args.find((a) => a === `--${name}`)
  if (exact) return ''
  const eq = args.find((a) => a.startsWith(`--${name}=`))
  return eq ? eq.split('=', 2)[1] : undefined
}
const flagPresent = (name: string) => args.includes(`--${name}`)

const limitArg = flag('limit')
const limit = limitArg ? parseInt(limitArg, 10) : DEFAULT_LIMIT
const feedIdArg = flag('feed-id')
const onlyFeedId = feedIdArg ? parseInt(feedIdArg, 10) : null
const refreshOnly = flagPresent('refresh-only')
const transcribeOnly = flagPresent('transcribe-only')
const testTarget = flag('test') // episode id (numeric) or uuid
const listMode = flagPresent('list')
const skipPrGeneration = flagPresent('no-pr')
const forceTranscribe = flagPresent('force-transcribe')
const ignoreGates = flagPresent('ignore-gates')

// ----- DB client ---------------------------------------------------------
const usesPgBouncer = DATABASE_URL.includes('pgbouncer=true')
const client = postgres(DATABASE_URL, {
  prepare: usesPgBouncer ? false : undefined,
  max: 1,
})
const db = drizzle(client, { schema })

const { podcastFeeds, podcastEpisodes, podcastEpisodeTranscripts, brandCredits, releases } = schema

const PODCAST_CREDIT_PRODUCT_TYPE = 'podcast_pr'
const FEED_AGE_GRACE_MINUTES = 60
const FEED_AGE_GRACE_MS = FEED_AGE_GRACE_MINUTES * 60 * 1000
const FUNDING_WARNING_COOLDOWN_HOURS = 24
const FUNDING_WARNING_COOLDOWN_MS = FUNDING_WARNING_COOLDOWN_HOURS * 60 * 60 * 1000
const PENDING_DRAFT_STATUSES = ['start', 'draft', 'draftnxt']

/**
 * Decide which feeds the cron may process this tick, and notify owners whose
 * brand needs funding.
 *
 * Two gates determine eligibility:
 *   1. Age — feed was added to the system at least 60 minutes ago. Gives the
 *      user time to configure parameters and fund the brand before anything
 *      runs.
 *   2. Effective credits > 0 — totalCredits (active podcast_pr SUM) minus the
 *      count of podcast-sourced drafts already awaiting finalize for that
 *      brand. Each pending draft is an unrealized credit obligation: if all
 *      pending drafts were submitted today, the user would burn that many
 *      credits. Generating MORE drafts on top would oversubscribe the
 *      balance. Example: 3 credits + 3 pending drafts = 0 effective; need
 *      4+ credits before generating draft #4.
 *
 * When age-eligible feeds fail the effective-credits gate, the owner is
 * notified via dispatchFundingNeededNotification (email/SMS/Slack per feed
 * preferences). A 24-hour cooldown column (funding_warning_sent_at) prevents
 * the notification from firing on every cron tick. Once effective credits
 * recover, the column is cleared so a future depletion fires a fresh warning.
 */
async function evaluateFeedEligibility(): Promise<{
  eligibleIds: Set<number>
  warnedCount: number
}> {
  const now = new Date()
  const ageCutoff = new Date(now.getTime() - FEED_AGE_GRACE_MS)
  const cooldownCutoff = new Date(now.getTime() - FUNDING_WARNING_COOLDOWN_MS)

  // Age-eligible, active, undeleted feeds. We always start from here; even
  // unfunded feeds need to be considered so we can fire the funding warning.
  const feeds = await db
    .select()
    .from(podcastFeeds)
    .where(
      and(
        eq(podcastFeeds.isDeleted, false),
        eq(podcastFeeds.isActive, true),
        lte(podcastFeeds.createdAt, ageCutoff),
      ),
    )

  if (feeds.length === 0) return { eligibleIds: new Set(), warnedCount: 0 }

  const companyIds = Array.from(new Set(feeds.map((f) => f.companyId)))

  // Active podcast_pr credit totals per company.
  const creditRows = await db
    .select({
      companyId: brandCredits.companyId,
      total: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)::int`,
    })
    .from(brandCredits)
    .where(
      and(
        inArray(brandCredits.companyId, companyIds),
        eq(brandCredits.productType, PODCAST_CREDIT_PRODUCT_TYPE),
        or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
      ),
    )
    .groupBy(brandCredits.companyId)
  const creditMap = new Map(
    creditRows
      .filter((r): r is { companyId: number; total: number } => r.companyId != null)
      .map((r) => [r.companyId, r.total]),
  )

  // Podcast-sourced drafts awaiting finalize per company. Each one is an
  // unrealized obligation against the credit balance.
  const draftRows = await db
    .select({
      companyId: releases.companyId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(releases)
    .innerJoin(podcastEpisodes, eq(podcastEpisodes.releaseId, releases.id))
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
      // Recovery: clear any prior funding warning so a future depletion can
      // fire a fresh notification.
      if (feed.fundingWarningSentAt) {
        await db
          .update(podcastFeeds)
          .set({ fundingWarningSentAt: null, updatedAt: new Date() })
          .where(eq(podcastFeeds.id, feed.id))
      }
      continue
    }

    // Effective balance is zero or negative. Fire a funding warning if we
    // haven't done so within the cooldown window.
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
        .update(podcastFeeds)
        .set({ fundingWarningSentAt: new Date(), updatedAt: new Date() })
        .where(eq(podcastFeeds.id, feed.id))
      warnedCount++
      log(
        'gate',
        `funding warning sent for feed ${feed.id} "${feed.title || feed.feedUrl}" ` +
          `(credits=${credits}, pendingDrafts=${pending})`,
      )
    } catch (err) {
      log(
        'gate',
        `funding warning dispatch failed for feed ${feed.id}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { eligibleIds, warnedCount }
}

// ----- helpers -----------------------------------------------------------
function log(scope: string, msg: string) {
  console.log(`[${new Date().toISOString()}] ${scope.padEnd(10)} ${msg}`)
}

function extensionFromUrl(url: string, contentType: string): string {
  const fromUrl = url.split('?')[0].split('.').pop()?.toLowerCase()
  if (fromUrl && /^[a-z0-9]{2,5}$/.test(fromUrl)) return fromUrl
  if (contentType.includes('mpeg')) return 'mp3'
  if (contentType.includes('mp4') || contentType.includes('m4a')) return 'm4a'
  if (contentType.includes('wav')) return 'wav'
  if (contentType.includes('ogg')) return 'ogg'
  return 'mp3'
}

// ----- RSS refresh -------------------------------------------------------
async function refreshFeed(feed: typeof podcastFeeds.$inferSelect) {
  log('refresh', `feed ${feed.id} "${feed.title || feed.feedUrl}"`)
  try {
    const parsed = await parsePodcastFeed(feed.feedUrl)

    let newEpisodes = 0
    for (const ep of parsed.episodes) {
      const inserted = await db
        .insert(podcastEpisodes)
        .values({
          uuid: uuidv4(),
          feedId: feed.id,
          guid: ep.guid.slice(0, 512),
          title: ep.title?.slice(0, 512),
          description: ep.description,
          audioUrl: ep.audioUrl,
          audioType: ep.audioType?.slice(0, 64),
          audioLengthBytes: ep.audioLengthBytes ?? null,
          durationSeconds: ep.durationSeconds ?? null,
          episodeNumber: ep.episodeNumber ?? null,
          seasonNumber: ep.seasonNumber ?? null,
          episodeType: ep.episodeType?.slice(0, 16),
          imageUrl: ep.imageUrl,
          chaptersUrl: ep.chaptersUrl,
          link: ep.link,
          publishedAt: ep.publishedAt ?? null,
          explicit: ep.explicit ?? false,
        })
        .onConflictDoNothing({ target: [podcastEpisodes.feedId, podcastEpisodes.guid] })
        .returning({ id: podcastEpisodes.id })
      if (inserted.length > 0) newEpisodes++
    }

    // Backfill chapters_url on existing episodes whose feeds newly start
    // exposing <podcast:chapters>. Only updates rows where chapters_url is
    // still NULL — no-op for episodes that already have it.
    for (const ep of parsed.episodes) {
      if (!ep.chaptersUrl) continue
      await db
        .update(podcastEpisodes)
        .set({ chaptersUrl: ep.chaptersUrl, updatedAt: new Date() })
        .where(
          and(
            eq(podcastEpisodes.feedId, feed.id),
            eq(podcastEpisodes.guid, ep.guid.slice(0, 512)),
            isNull(podcastEpisodes.chaptersUrl),
          ),
        )
    }

    const lastEpisodeAt = parsed.episodes
      .map((e) => e.publishedAt)
      .filter((d): d is Date => d instanceof Date && !Number.isNaN(d.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0]

    await db
      .update(podcastFeeds)
      .set({
        title: parsed.title.slice(0, 255),
        description: parsed.description ?? null,
        imageUrl: parsed.imageUrl ?? null,
        author: parsed.author?.slice(0, 255) ?? null,
        language: parsed.language?.slice(0, 16) ?? null,
        link: parsed.link ?? null,
        itunesCategory: parsed.itunesCategory?.slice(0, 128) ?? null,
        lastFetchedAt: new Date(),
        lastEpisodePublishedAt: lastEpisodeAt ?? feed.lastEpisodePublishedAt,
        fetchError: null,
        updatedAt: new Date(),
      })
      .where(eq(podcastFeeds.id, feed.id))

    log('refresh', `  ${parsed.episodes.length} items in feed, ${newEpisodes} new`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log('refresh', `  FAILED: ${msg}`)
    await db
      .update(podcastFeeds)
      .set({
        lastFetchedAt: new Date(),
        fetchError: msg.slice(0, 2000),
        updatedAt: new Date(),
      })
      .where(eq(podcastFeeds.id, feed.id))
  }
}

async function refreshAllFeeds(eligibleFeedIds: Set<number>) {
  const conditions = [eq(podcastFeeds.isDeleted, false), eq(podcastFeeds.isActive, true)]
  if (onlyFeedId) conditions.push(eq(podcastFeeds.id, onlyFeedId))

  const feeds = await db.query.podcastFeeds.findMany({
    where: and(...conditions),
    orderBy: asc(podcastFeeds.lastFetchedAt),
  })

  const eligible = feeds.filter((f) => eligibleFeedIds.has(f.id))
  const skipped = feeds.length - eligible.length
  log(
    'refresh',
    `${eligible.length} feed(s) to refresh` +
      (skipped > 0 ? ` (${skipped} skipped: <${FEED_AGE_GRACE_MINUTES}m old or no podcast_pr credits)` : ''),
  )
  for (const feed of eligible) await refreshFeed(feed)
}

// ----- transcription via AssemblyAI -------------------------------------
interface AssemblyUtterance {
  speaker: string
  text: string
  start: number
  end: number
  confidence?: number
}

interface AssemblyTranscript {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'error'
  text?: string
  audio_duration?: number
  language_code?: string
  speech_model?: string
  utterances?: AssemblyUtterance[]
  error?: string
  [k: string]: unknown
}

async function submitTranscription(audioUrl: string): Promise<string> {
  const res = await fetch(ASSEMBLYAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: ASSEMBLYAI_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      // Required per AssemblyAI docs — ordered fallback list, no default.
      speech_models: ['universal-3-pro', 'universal-2'],
      speaker_labels: true,
      language_detection: true,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`AssemblyAI submit failed (${res.status}): ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as AssemblyTranscript
  return data.id
}

async function pollTranscription(id: string): Promise<AssemblyTranscript> {
  const start = Date.now()
  while (true) {
    const res = await fetch(`${ASSEMBLYAI_ENDPOINT}/${id}`, {
      headers: { Authorization: ASSEMBLYAI_API_KEY! },
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`AssemblyAI poll failed (${res.status}): ${body.slice(0, 500)}`)
    }
    const data = (await res.json()) as AssemblyTranscript
    if (data.status === 'completed') return data
    if (data.status === 'error') throw new Error(data.error || 'AssemblyAI returned error status')
    if (Date.now() - start > TRANSCRIBE_TIMEOUT_MS) {
      throw new Error(`Transcription exceeded ${TRANSCRIBE_TIMEOUT_MS / 1000}s timeout`)
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

function normalizeSegments(utterances?: AssemblyUtterance[]) {
  if (!utterances) return null
  return utterances.map((u) => ({
    start: u.start / 1000,
    end: u.end / 1000,
    text: u.text,
    speaker: u.speaker,
    confidence: u.confidence ?? null,
  }))
}

async function downloadAudioAndArchive(
  episodeId: number,
  feedId: number,
  audioUrl: string,
): Promise<string> {
  const res = await fetch(audioUrl)
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${audioUrl}`)
  const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
  if (contentLength > MAX_AUDIO_BYTES) {
    throw new Error(`Audio file too large: ${contentLength} bytes (max ${MAX_AUDIO_BYTES})`)
  }
  const contentType = res.headers.get('content-type') || 'audio/mpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_AUDIO_BYTES) {
    throw new Error(`Audio file too large after read: ${buf.byteLength} bytes`)
  }
  const ext = extensionFromUrl(audioUrl, contentType)
  return uploadPodcastAudio(buf, feedId, episodeId, contentType, ext)
}

async function claimPendingEpisode(id: number): Promise<boolean> {
  // Atomic claim: only one worker wins. Other concurrent workers see 0 rows.
  const claimed = await db
    .update(podcastEpisodes)
    .set({ transcriptionStatus: 'downloading', updatedAt: new Date() })
    .where(
      and(
        eq(podcastEpisodes.id, id),
        eq(podcastEpisodes.transcriptionStatus, 'pending'),
        eq(podcastEpisodes.skip, false),
      ),
    )
    .returning({ id: podcastEpisodes.id })
  return claimed.length > 0
}

async function forceClaimEpisode(id: number): Promise<void> {
  await db
    .update(podcastEpisodes)
    .set({
      transcriptionStatus: 'downloading',
      transcriptionError: null,
      updatedAt: new Date(),
    })
    .where(eq(podcastEpisodes.id, id))
  // Remove any existing transcript so the new one doesn't violate the UNIQUE constraint
  await db.delete(podcastEpisodeTranscripts).where(eq(podcastEpisodeTranscripts.episodeId, id))
}

async function markFailed(episodeId: number, error: string) {
  await db
    .update(podcastEpisodes)
    .set({
      transcriptionStatus: 'failed',
      transcriptionError: error.slice(0, 2000),
      updatedAt: new Date(),
    })
    .where(eq(podcastEpisodes.id, episodeId))
}

async function processEpisode(
  ep: typeof podcastEpisodes.$inferSelect,
  opts: { force?: boolean } = {},
) {
  const tag = opts.force ? 'test' : 'transcribe'
  log(tag, `episode ${ep.id} "${ep.title?.slice(0, 60) || '(no title)'}"`)

  if (!ep.audioUrl) {
    await markFailed(ep.id, 'No audio URL in RSS feed')
    log(tag, `  FAILED: no audio_url`)
    return
  }

  if (opts.force) {
    await forceClaimEpisode(ep.id)
    log(tag, `  force-claim (any prior transcript deleted)`)
  } else {
    const claimed = await claimPendingEpisode(ep.id)
    if (!claimed) {
      log(tag, `  skipped (claimed by another worker or no longer pending)`)
      return
    }
  }

  let audioForTranscription = ep.audioUrl
  try {
    // 1. Download audio + archive to S3 (so we keep a copy) — but skip the
    // download if we already have a stored copy from a previous run.
    if (ep.audioStorageUrl && ep.audioDownloadedAt) {
      log('transcribe', `  reusing archived audio (${ep.audioStorageUrl})`)
      audioForTranscription = ep.audioStorageUrl
      await db
        .update(podcastEpisodes)
        .set({ transcriptionStatus: 'transcribing', updatedAt: new Date() })
        .where(eq(podcastEpisodes.id, ep.id))
    } else {
      log('transcribe', `  downloading audio...`)
      const storageUrl = await downloadAudioAndArchive(ep.id, ep.feedId, ep.audioUrl)
      await db
        .update(podcastEpisodes)
        .set({
          audioStorageUrl: storageUrl,
          audioDownloadedAt: new Date(),
          transcriptionStatus: 'transcribing',
          updatedAt: new Date(),
        })
        .where(eq(podcastEpisodes.id, ep.id))
      audioForTranscription = storageUrl
    }

    // 2. Submit to AssemblyAI
    log('transcribe', `  submitting to AssemblyAI...`)
    const transcriptId = await submitTranscription(audioForTranscription)
    log('transcribe', `  job ${transcriptId} — polling...`)

    // 3. Poll
    const result = await pollTranscription(transcriptId)
    const segments = normalizeSegments(result.utterances)
    const speakers = new Set(result.utterances?.map((u) => u.speaker) || [])
    log(
      'transcribe',
      `  done: ${Math.round(result.audio_duration || 0)}s audio, ` +
        `${result.text?.length || 0} chars, ${speakers.size} speaker(s)`,
    )

    // 4. Persist transcript + mark complete
    await db.transaction(async (tx) => {
      await tx.insert(podcastEpisodeTranscripts).values({
        uuid: uuidv4(),
        episodeId: ep.id,
        provider: 'assemblyai',
        // Store the resolved model AssemblyAI actually used (falls back through
        // the speech_models list). Useful when the requested model wasn't
        // available and the response came from the fallback.
        model: result.speech_model?.slice(0, 64) || 'universal-3-pro',
        language: result.language_code?.slice(0, 16) ?? null,
        text: result.text || '',
        segments,
        providerResponse: result as unknown as Record<string, unknown>,
        durationSeconds: result.audio_duration ? Math.round(result.audio_duration) : null,
        costCents: null,
      })
      await tx
        .update(podcastEpisodes)
        .set({
          transcriptionStatus: 'completed',
          transcribedAt: new Date(),
          transcriptionError: null,
          updatedAt: new Date(),
        })
        .where(eq(podcastEpisodes.id, ep.id))
    })

    // 5. Generate press release draft (idempotent — skips if release exists)
    if (!skipPrGeneration) {
      log(tag, `  generating press release draft...`)
      try {
        const prResult = await generatePressReleaseFromEpisode(ep.id)
        if (prResult.status === 'created') {
          log(
            tag,
            `  draft created: ${prResult.releaseUuid} ` +
              `(faqs=${prResult.faqsCreated}, ` +
              `banner=${prResult.bannerCreated}, ` +
              `newsImage=${prResult.newsImageCreated}, ` +
              `chapterImages=${prResult.chapterImagesCreated}, ` +
              `categories=${prResult.categoriesAttached}, ` +
              `regions=${prResult.regionsAttached})`,
          )
          for (const w of prResult.warnings) log(tag, `    warning: ${w}`)
        } else if (prResult.status === 'already-exists') {
          log(tag, `  draft already exists (release id ${prResult.releaseId}) — skipped`)
        } else if (prResult.status === 'no-transcript') {
          log(tag, `  draft skipped: no transcript`)
        } else {
          log(tag, `  draft skipped: ${prResult.error}`)
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        log(tag, `  draft generation crashed: ${m}`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(tag, `  FAILED: ${msg}`)
    await markFailed(ep.id, msg)
  }
}

async function transcribePending(eligibleFeedIds: Set<number>) {
  if (!ASSEMBLYAI_API_KEY) {
    log('transcribe', 'ASSEMBLYAI_API_KEY not set — skipping transcription step')
    return
  }

  if (eligibleFeedIds.size === 0) {
    log('transcribe', 'no eligible feeds (all <60m old or unfunded) — skipping')
    return
  }

  const conditions = [
    eq(podcastEpisodes.skip, false),
    eq(podcastEpisodes.transcriptionStatus, 'pending'),
    inArray(podcastEpisodes.feedId, Array.from(eligibleFeedIds)),
  ]

  // Restrict to one feed if requested
  if (onlyFeedId) conditions.push(eq(podcastEpisodes.feedId, onlyFeedId))

  // Only consider episodes whose feed is active + not deleted
  const candidates = await db
    .select({
      id: podcastEpisodes.id,
      feedId: podcastEpisodes.feedId,
      uuid: podcastEpisodes.uuid,
      title: podcastEpisodes.title,
      audioUrl: podcastEpisodes.audioUrl,
      skip: podcastEpisodes.skip,
      transcriptionStatus: podcastEpisodes.transcriptionStatus,
      publishedAt: podcastEpisodes.publishedAt,
    })
    .from(podcastEpisodes)
    .innerJoin(podcastFeeds, eq(podcastFeeds.id, podcastEpisodes.feedId))
    .where(
      and(
        eq(podcastFeeds.isDeleted, false),
        eq(podcastFeeds.isActive, true),
        ...conditions,
      ),
    )
    .orderBy(
      // Newest episodes first; null publishedAt last
      sql`${podcastEpisodes.publishedAt} desc nulls last`,
      asc(podcastEpisodes.id),
    )
    .limit(limit)

  log('transcribe', `${candidates.length} pending episode(s) (limit=${limit})`)
  for (const ep of candidates) {
    // Re-fetch full row right before processing (in case of stale data)
    const full = await db.query.podcastEpisodes.findFirst({
      where: eq(podcastEpisodes.id, ep.id),
    })
    if (!full) continue
    await processEpisode(full)
  }
}

async function backfillMissingReleases(eligibleFeedIds: Set<number>) {
  if (skipPrGeneration) {
    log('pr-backfill', 'skipped (--no-pr)')
    return
  }

  if (eligibleFeedIds.size === 0) {
    log('pr-backfill', 'no eligible feeds (all <60m old or unfunded) — skipping')
    return
  }

  const conditions = [
    eq(podcastFeeds.isDeleted, false),
    eq(podcastFeeds.isActive, true),
    eq(podcastEpisodes.skip, false),
    eq(podcastEpisodes.transcriptionStatus, 'completed'),
    isNull(podcastEpisodes.releaseId),
    inArray(podcastEpisodes.feedId, Array.from(eligibleFeedIds)),
  ]
  if (onlyFeedId) conditions.push(eq(podcastEpisodes.feedId, onlyFeedId))

  const candidates = await db
    .select({ id: podcastEpisodes.id, uuid: podcastEpisodes.uuid, title: podcastEpisodes.title })
    .from(podcastEpisodes)
    .innerJoin(podcastFeeds, eq(podcastFeeds.id, podcastEpisodes.feedId))
    .where(and(...conditions))
    .orderBy(sql`${podcastEpisodes.publishedAt} desc nulls last`, asc(podcastEpisodes.id))
    .limit(limit)

  log('pr-backfill', `${candidates.length} episode(s) with transcript but no release`)
  for (const ep of candidates) {
    log('pr-backfill', `episode ${ep.id} "${ep.title?.slice(0, 60) || '(no title)'}"`)
    try {
      const prResult = await generatePressReleaseFromEpisode(ep.id)
      if (prResult.status === 'created') {
        log(
          'pr-backfill',
          `  draft created: ${prResult.releaseUuid} ` +
            `(faqs=${prResult.faqsCreated}, banner=${prResult.bannerCreated}, ` +
            `newsImage=${prResult.newsImageCreated}, ` +
            `chapterImages=${prResult.chapterImagesCreated})`,
        )
        for (const w of prResult.warnings) log('pr-backfill', `    warning: ${w}`)
      } else {
        log(
          'pr-backfill',
          `  result: ${prResult.status}${'error' in prResult && prResult.error ? ` — ${prResult.error}` : ''}`,
        )
      }
    } catch (err) {
      log('pr-backfill', `  crashed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

async function runListMode() {
  const conditions = [eq(podcastFeeds.isDeleted, false), eq(podcastEpisodes.skip, false)]
  if (onlyFeedId) conditions.push(eq(podcastFeeds.id, onlyFeedId))

  const rows = await db
    .select({
      id: podcastEpisodes.id,
      uuid: podcastEpisodes.uuid,
      feedId: podcastEpisodes.feedId,
      feedTitle: podcastFeeds.title,
      title: podcastEpisodes.title,
      status: podcastEpisodes.transcriptionStatus,
      skip: podcastEpisodes.skip,
      publishedAt: podcastEpisodes.publishedAt,
    })
    .from(podcastEpisodes)
    .innerJoin(podcastFeeds, eq(podcastFeeds.id, podcastEpisodes.feedId))
    .where(and(...conditions))
    .orderBy(sql`${podcastEpisodes.publishedAt} desc nulls last`, asc(podcastEpisodes.id))
    .limit(limit > 0 ? limit : 20)

  if (rows.length === 0) {
    console.log('No episodes found.')
    return
  }

  console.log(
    rows
      .map(
        (r) =>
          `id=${String(r.id).padStart(5)}  status=${r.status.padEnd(12)}  ` +
          `skip=${String(r.skip).padEnd(5)}  uuid=${r.uuid}\n` +
          `  feed#${r.feedId} "${(r.feedTitle || '').slice(0, 60)}"\n` +
          `  episode "${(r.title || '(no title)').slice(0, 80)}"\n` +
          `  published ${r.publishedAt ? new Date(r.publishedAt).toISOString() : '(unknown)'}\n`,
      )
      .join('\n'),
  )
  console.log(`Showing ${rows.length} episode(s). Pass --limit=N to change count.\n`)
  console.log(`To test one: doppler run -- bun scripts/refresh-podcast-feeds.ts --test=<uuid>`)
}

async function runTestMode(target: string) {
  const asNum = /^\d+$/.test(target) ? parseInt(target, 10) : null
  const episode = await db.query.podcastEpisodes.findFirst({
    where: asNum != null ? eq(podcastEpisodes.id, asNum) : eq(podcastEpisodes.uuid, target),
  })

  if (!episode) {
    log('test', `no episode found for ${target}`)
    return
  }

  log('test', `target episode ${episode.id} (uuid=${episode.uuid})`)
  log('test', `current status: ${episode.transcriptionStatus}, skip=${episode.skip}, releaseId=${episode.releaseId ?? 'none'}`)

  // Enforce the same gates as the cron flow unless explicitly overridden.
  // Without --ignore-gates we refuse to process episodes belonging to a feed
  // that is too new or whose company has no podcast_pr credits.
  if (!ignoreGates) {
    const { eligibleIds: eligibleFeedIds } = await evaluateFeedEligibility()
    if (!eligibleFeedIds.has(episode.feedId)) {
      log(
        'test',
        `  refusing: feed ${episode.feedId} is <${FEED_AGE_GRACE_MINUTES}m old or has insufficient effective podcast_pr credits ` +
          `(credits must exceed pending drafts). Pass --ignore-gates to override.`,
      )
      return
    }
  } else {
    log('test', `  --ignore-gates set: skipping age+effective-credit gate (dev override)`)
  }

  // If a transcript already exists and no release has been created yet, just
  // regenerate the press release — don't burn a new AssemblyAI run. Override
  // with --force-transcribe to redo the transcript anyway.
  if (!forceTranscribe && !episode.releaseId) {
    const existing = await db.query.podcastEpisodeTranscripts.findFirst({
      where: eq(podcastEpisodeTranscripts.episodeId, episode.id),
    })
    if (existing && existing.text?.trim()) {
      log('test', `  transcript already exists (${existing.text.length} chars) — skipping transcription, regenerating PR only`)
      if (skipPrGeneration) {
        log('test', `  --no-pr set, nothing to do`)
        return
      }
      try {
        const prResult = await generatePressReleaseFromEpisode(episode.id)
        if (prResult.status === 'created') {
          log(
            'test',
            `  draft created: ${prResult.releaseUuid} ` +
              `(faqs=${prResult.faqsCreated}, ` +
              `banner=${prResult.bannerCreated}, ` +
              `newsImage=${prResult.newsImageCreated}, ` +
              `chapterImages=${prResult.chapterImagesCreated}, ` +
              `categories=${prResult.categoriesAttached}, ` +
              `regions=${prResult.regionsAttached})`,
          )
          for (const w of prResult.warnings) log('test', `    warning: ${w}`)
        } else {
          log('test', `  draft result: ${prResult.status}${'error' in prResult && prResult.error ? ` — ${prResult.error}` : ''}`)
        }
      } catch (err) {
        log('test', `  draft generation crashed: ${err instanceof Error ? err.message : String(err)}`)
      }
      return
    }
  }

  if (!ASSEMBLYAI_API_KEY) {
    log('test', 'ASSEMBLYAI_API_KEY not set — cannot transcribe')
    return
  }

  await processEpisode(episode, { force: true })
}

// ----- main --------------------------------------------------------------
async function main() {
  log('start', `args: ${args.join(' ') || '(none)'}`)

  if (listMode) {
    await runListMode()
    await client.end()
    return
  }

  if (testTarget) {
    await runTestMode(testTarget)
    log('done', 'finished')
    await client.end()
    return
  }

  const { eligibleIds: eligibleFeedIds, warnedCount } = await evaluateFeedEligibility()
  log(
    'gate',
    `${eligibleFeedIds.size} feed(s) pass age+effective-credit gate ` +
      `(age >= ${FEED_AGE_GRACE_MINUTES}m, credits > pending drafts), ` +
      `${warnedCount} funding warning(s) sent`,
  )

  if (!transcribeOnly) {
    await refreshAllFeeds(eligibleFeedIds)
  } else {
    log('refresh', 'skipped (--transcribe-only)')
  }

  if (!refreshOnly) {
    await transcribePending(eligibleFeedIds)
    await backfillMissingReleases(eligibleFeedIds)
  } else {
    log('transcribe', 'skipped (--refresh-only)')
  }

  log('done', 'finished')
  await client.end()
}

main().catch(async (err) => {
  console.error(err)
  await client.end().catch(() => {})
  process.exit(1)
})
