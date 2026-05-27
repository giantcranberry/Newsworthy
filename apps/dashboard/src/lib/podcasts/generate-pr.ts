/**
 * Generate a press release draft from a transcribed podcast episode.
 *
 * Backed by Claude Sonnet 4.6 (1M context) — adaptive thinking, prompt
 * caching on shared transcript context, structured JSON output schema.
 *
 * Inputs: an episode row that already has a completed transcript.
 * Outputs:
 *   - A `releases` row (status='draftnxt') with title/abstract/body/pullquote/
 *     location, slug, landingPage = episode link.
 *   - Primary category inserted into `release_categories`.
 *   - Target regions inserted into `release_regions`.
 *   - 4-6 FAQs inserted into `release_faqs`.
 *   - Banner: episode/show artwork at 1200×630 using a blurred-background
 *     "fit with background" composite (matches the client-side cropper),
 *     inserted into `banners` and linked via `releases.banner_id`.
 *   - News image: same artwork (preserving aspect ratio, ≤1200×1200) inserted
 *     into `images` + `release_images` and linked via `releases.primary_image_id`.
 *
 * Idempotent: skips entirely if the episode already has a release.
 * Credit is NOT consumed here — credits are consumed at distribution approval.
 */

import Anthropic from '@anthropic-ai/sdk'
import slugify from 'slugify'
import { v4 as uuidv4 } from 'uuid'
import { randomUUID } from 'crypto'
import { eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import {
  releases,
  releaseFaqs,
  releaseCategories,
  releaseRegions,
  releaseImages,
  banners,
  images,
  podcastEpisodes,
  podcastEpisodeTranscripts,
  podcastFeeds,
  company,
  category as categoryTable,
  region as regionTable,
} from '@/db/schema'
import { uploadPodcastBanner, uploadPRImage } from '@/services/s3'
import { dispatchNewDraftNotifications } from './notify'
import { fetchChapterImages } from './chapters'

const MAX_TRANSCRIPT_CHARS = 200_000 // ~50K tokens; well inside Opus 4.7's 1M context
const MODEL = 'claude-opus-4-7'
const RELEASE_MAX_TOKENS = 16_000 // headroom for adaptive thinking + ~500-word body + structured fields
const FAQ_MAX_TOKENS = 8_000

export interface PrGenerationOptions {
  skipBanner?: boolean
  skipFaqs?: boolean
  skipNewsImage?: boolean
}

export interface PrGenerationResult {
  status: 'created' | 'already-exists' | 'no-transcript' | 'error'
  releaseId?: number
  releaseUuid?: string
  bannerCreated: boolean
  newsImageCreated: boolean
  chapterImagesCreated: number
  faqsCreated: number
  categoriesAttached: number
  regionsAttached: number
  error?: string
  warnings: string[]
}

interface ReleaseFields {
  title: string
  abstract: string
  pullquote: string
  location: string | null
  body: string
  primaryCategoryId: number | null
  regionIds: number[]
}

interface FaqRow {
  question: string
  answer: string
}

function getAnthropic() {
  if (!process.env.CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY env var is not set')
  }
  return new Anthropic({ apiKey: process.env.CLAUDE_API_KEY })
}

function makeSlug(title: string): string {
  return slugify(title, { lower: true, strict: true, trim: true }).slice(0, 200)
}

function truncateTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text
  return text.slice(0, MAX_TRANSCRIPT_CHARS) + '\n\n[transcript truncated for length]'
}

function extractJsonText(response: Anthropic.Message): string {
  for (const block of response.content) {
    if (block.type === 'text') return block.text
  }
  // Diagnostic — common cause is max_tokens exhausted during thinking
  const types = response.content.map((b) => b.type).join(', ') || '(empty)'
  const usage = response.usage
    ? `in=${response.usage.input_tokens} out=${response.usage.output_tokens}`
    : '(no usage)'
  throw new Error(
    `No text in response (stop_reason=${response.stop_reason}, blocks=[${types}], usage=${usage}). ` +
      'If stop_reason is "max_tokens", raise max_tokens — thinking tokens count toward the budget.',
  )
}

const RELEASE_SYSTEM_PROMPT =
  'You are a senior press release writer with deep experience writing podcast PR for major shows. ' +
  'You write in third person, professional news style, rich with specific detail drawn from the source transcript. ' +
  'You NEVER invent specific quotes attributed to real people — you only quote what the transcript shows verbatim. ' +
  'When length is specified, you hit it — under-writing is a failure. ' +
  'You always return valid JSON matching the requested schema.'

function buildSharedContext(args: {
  brandName: string
  brandDescription?: string | null
  showTitle?: string | null
  showAuthor?: string | null
  episodeTitle?: string | null
  episodeDescription?: string | null
  episodeNumber?: number | null
  seasonNumber?: number | null
  episodeLink?: string | null
  publishedAt?: Date | null
  transcript: string
}): string {
  const epRef =
    args.seasonNumber != null && args.episodeNumber != null
      ? `S${args.seasonNumber} E${args.episodeNumber}`
      : args.episodeNumber != null
        ? `Episode ${args.episodeNumber}`
        : ''
  const pubDate = args.publishedAt
    ? args.publishedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  return [
    '== BRAND ==',
    args.brandName + (args.brandDescription ? `\n${args.brandDescription}` : ''),
    '',
    '== PODCAST SHOW ==',
    `Title: ${args.showTitle || '(unknown)'}`,
    args.showAuthor ? `Host(s)/Author: ${args.showAuthor}` : '',
    '',
    '== EPISODE ==',
    `Title: ${args.episodeTitle || '(untitled)'}`,
    epRef ? `Reference: ${epRef}` : '',
    pubDate ? `Published: ${pubDate}` : '',
    args.episodeLink ? `Episode page: ${args.episodeLink}` : '',
    args.episodeDescription ? `Show notes: ${args.episodeDescription.slice(0, 1000)}` : '',
    '',
    '== FULL EPISODE TRANSCRIPT (speaker-labeled where the source provided it) ==',
    truncateTranscript(args.transcript),
  ]
    .filter((s) => s !== '')
    .join('\n')
}

const RELEASE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Unique engagement-driving headline focused on the episode\'s news angle. MUST be ≤ 80 chars. Title Case. MUST NOT start with the show name or "Episode N" or the episode title — write a fresh standalone headline.' },
    abstract: { type: 'string', description: '2-3 sentence summary, max 350 chars' },
    pullquote: { type: 'string', description: 'A verbatim line from the transcript that is genuinely quotable, max 350 chars' },
    location: { type: ['string', 'null'], description: 'Dateline-style "City, State" or null if not inferable' },
    body: { type: 'string', description: 'Full press release in HTML, 450-550 words, 5 paragraphs. Allowed tags: <p>, <strong>, <em>, <a>, <h3>, <ul>, <li>, <blockquote>. No em dashes (—) or en dashes (–). Last paragraph must begin with an <h3>About {show name}</h3> heading on its own line.' },
    primaryCategoryId: { type: ['integer', 'null'], description: 'The single most appropriate category id from the AVAILABLE CATEGORIES list' },
    regionIds: {
      type: 'array',
      items: { type: 'integer' },
      description: '1-5 region ids most relevant to the episode\'s geographic focus, or empty for global/abstract topics',
    },
  },
  required: ['title', 'abstract', 'pullquote', 'location', 'body', 'primaryCategoryId', 'regionIds'],
  additionalProperties: false,
} as const

const FAQ_SCHEMA = {
  type: 'object',
  properties: {
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
        },
        required: ['question', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['faqs'],
  additionalProperties: false,
} as const

async function generateReleaseFields(args: {
  brandName: string
  brandDescription?: string | null
  showTitle?: string | null
  showAuthor?: string | null
  episodeTitle?: string | null
  episodeDescription?: string | null
  episodeNumber?: number | null
  seasonNumber?: number | null
  episodeLink?: string | null
  publishedAt?: Date | null
  transcript: string
  categories: { id: number; name: string; description: string | null }[]
  regions: { id: number; name: string; state: string }[]
}): Promise<ReleaseFields> {
  const sharedContext = buildSharedContext(args)
  const categoryList = args.categories
    .map((c) => `${c.id}: ${c.name}${c.description ? ` — ${c.description}` : ''}`)
    .join('\n')
  const regionList = args.regions.map((r) => `${r.id}: ${r.name}, ${r.state}`).join('\n')

  const instructions = `Write a professional press release announcing this podcast episode. Mine the transcript heavily for specific details, named people/organizations, topic threads, and quotable lines.

AVAILABLE CATEGORIES:
${categoryList}

AVAILABLE REGIONS:
${regionList}

Required fields and length budgets — hit them. Under-writing is a failure.

1. **title** — **≤ 80 characters.** Title Case. A unique, engagement-driving headline built around the episode's most newsworthy idea or claim. **DO NOT** start with the show name, "Episode N", or the raw episode title (e.g., NOT "No Agenda Episode 1871 'Hatman':..."). Write a standalone headline that would work on its own as a news article. Lead with the angle, the conflict, the named person/event, or the surprising claim. The show name belongs in the body, not the headline.

2. **abstract** — 2-3 sentences, ≤ 350 chars. Names the topic and gives the reader a reason to listen. Mention guest names if applicable.

3. **pullquote** — A verbatim line from the transcript that is genuinely quotable. Use the speaker's actual words. Include the speaker name/role if the transcript identifies them. ≤ 350 chars. NEVER invent quotes attributed to real people.

4. **location** — Dateline-style "City, State" or "City, Country". Use the brand's location if known; otherwise the city the show is recorded in if mentioned. Return null if you genuinely can't infer.

5. **body** — Full press release in HTML. **TARGET: 450-550 words. MINIMUM: 400 words.** Five paragraphs, each a full ~80-110 words. Allowed tags: <p>, <strong>, <em>, <a href="...">, <h3>, <ul>, <li>, <blockquote>. No <h1>/<h2>. No "FOR IMMEDIATE RELEASE" header. No contact info.

   **PUNCTUATION:** Do NOT use em dashes (—) or en dashes (–) anywhere in the body. Use commas, periods, semicolons, colons, or parentheses instead. Replace any em dash you would have written with the most natural alternative for the sentence.

   **EPISODE LINK:** If an "Episode page:" URL is provided in the EPISODE context above, hyperlink the FIRST mention of the episode (the "Episode N" reference or episode title) in paragraph 1 using <a href="{episode page URL}">…</a>. Only hyperlink once; do not link every mention. If no episode page URL is provided, skip the link.

   **OPTIONAL FORMATTING:** You may use a <ul>/<li> bullet list to summarize 3-5 distinct topic threads in paragraph 2 if it improves scannability. You may use a <blockquote> for a particularly strong verbatim quote in paragraph 3 (in place of, not in addition to, an inline <em> quote). Use these sparingly; default to flowing prose.

   PARAGRAPH 1 (Lede, ~80-100 words): Open with the episode reference (e.g., "Episode 1871 of {show}, titled '{episode title}', hosted by {hosts}, brings listeners..."). State the central topic and why it is newsworthy NOW. Include the published date if known.

   PARAGRAPH 2 (Topic preview, ~90-110 words): What listeners can expect. Name 2-3 specific topic threads, debates, frameworks, or angles covered in the episode. Pull them by name from the transcript. Reference specific named entities (people, organizations, events) where possible.

   PARAGRAPH 3 (Voice + verbatim quote, ~90-110 words): Demonstrate the hosts'/guests' approach. Embed one or two real quotes pulled VERBATIM from the transcript with proper attribution. Set quotes off with <em> tags, quotation marks, or a <blockquote>. Each quote must come from the transcript. Do not paraphrase, do not invent.

   PARAGRAPH 4 (Depth/context, ~90-110 words): Go deeper on one or two of the most substantive ideas. Name people, organizations, places, theories, books, events, or data points specifically mentioned by the hosts or guests. This paragraph is what separates a real press release from a generic stub. Be specific.

   PARAGRAPH 5 (Closing + boilerplate, ~80-90 words): Start with a standalone heading line: <h3>About {show name}</h3> (use the podcast/show name, not the brand legal name). Follow it with a <p> containing a brief description of the show. Its premise, voice, audience, and what makes it distinctive. Use the brand description above if provided. End with a call to listen (e.g., "Episode {N} is available now wherever podcasts are heard.").

6. **primaryCategoryId** — Single most appropriate category id from AVAILABLE CATEGORIES. Pick the BEST match.

7. **regionIds** — 1-5 region ids most relevant to the episode's geographic focus. Return [] for global/abstract topics.

Return JSON matching the schema. Do not include any prose outside the JSON.`

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: RELEASE_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: RELEASE_SYSTEM_PROMPT,
    output_config: {
      format: { type: 'json_schema', schema: RELEASE_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: sharedContext, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: instructions },
        ],
      },
    ],
  })

  const text = extractJsonText(response)
  const parsed = JSON.parse(text) as ReleaseFields
  if (!parsed.title || !parsed.abstract || !parsed.body) {
    throw new Error('Generation missing required fields (title/abstract/body)')
  }
  return {
    ...parsed,
    primaryCategoryId: parsed.primaryCategoryId ?? null,
    regionIds: Array.isArray(parsed.regionIds) ? parsed.regionIds : [],
  }
}

async function generateFaqs(args: {
  sharedContext: string
  releaseTitle: string
  releaseBody: string
}): Promise<FaqRow[]> {
  const instructions = `Generate 4-6 reader FAQs grounded in the transcript and the press release below.

PRESS RELEASE TITLE: ${args.releaseTitle}

PRESS RELEASE BODY:
${args.releaseBody.slice(0, 5000)}

Rules:
- Answer questions a reader would genuinely want answered after the press release
- Pull facts from the transcript — do not invent specifics
- Answers are 1-3 sentences, 40-80 words each
- Mix factual ("Who is X?") and analytical ("Why does Y matter?") questions

Return JSON matching the schema. Do not include any prose outside the JSON.`

  const anthropic = getAnthropic()
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: FAQ_MAX_TOKENS,
    thinking: { type: 'adaptive' },
    system: RELEASE_SYSTEM_PROMPT,
    output_config: {
      format: { type: 'json_schema', schema: FAQ_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: args.sharedContext, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: instructions },
        ],
      },
    ],
  })

  const text = extractJsonText(response)
  const parsed = JSON.parse(text) as { faqs?: FaqRow[] }
  return (parsed.faqs || []).filter((f) => f?.question?.trim() && f?.answer?.trim())
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}) for ${url}`)
  const ct = res.headers.get('content-type') || ''
  if (!ct.startsWith('image/')) throw new Error(`URL did not return an image (content-type: ${ct})`)
  return Buffer.from(await res.arrayBuffer())
}

async function loadTaxonomy() {
  const [allCats, allRegions] = await Promise.all([
    db
      .select({
        id: categoryTable.id,
        name: categoryTable.name,
        description: categoryTable.description,
      })
      .from(categoryTable),
    db
      .select({ id: regionTable.id, name: regionTable.name, state: regionTable.state })
      .from(regionTable),
  ])
  return { categories: allCats, regions: allRegions }
}

export async function generatePressReleaseFromEpisode(
  episodeId: number,
  options: PrGenerationOptions = {},
): Promise<PrGenerationResult> {
  const warnings: string[] = []
  let bannerCreated = false
  let newsImageCreated = false
  let faqsCreated = 0
  let categoriesAttached = 0
  let regionsAttached = 0
  let chapterImagesCreated = 0

  const baseResult: Omit<PrGenerationResult, 'status'> = {
    bannerCreated,
    newsImageCreated,
    chapterImagesCreated,
    faqsCreated,
    categoriesAttached,
    regionsAttached,
    warnings,
  }

  const episode = await db.query.podcastEpisodes.findFirst({
    where: eq(podcastEpisodes.id, episodeId),
  })
  if (!episode) return { ...baseResult, status: 'error', error: 'Episode not found' }
  if (episode.releaseId) {
    return { ...baseResult, status: 'already-exists', releaseId: episode.releaseId }
  }

  const transcript = await db.query.podcastEpisodeTranscripts.findFirst({
    where: eq(podcastEpisodeTranscripts.episodeId, episode.id),
  })
  if (!transcript || !transcript.text?.trim()) {
    return { ...baseResult, status: 'no-transcript', error: 'Episode has no transcript yet' }
  }

  const feed = await db.query.podcastFeeds.findFirst({
    where: eq(podcastFeeds.id, episode.feedId),
  })
  if (!feed) return { ...baseResult, status: 'error', error: 'Feed not found' }

  const brand = await db.query.company.findFirst({
    where: eq(company.id, feed.companyId),
  })
  if (!brand) return { ...baseResult, status: 'error', error: 'Brand (company) not found' }

  const taxonomy = await loadTaxonomy()

  const sharedContextArgs = {
    brandName: brand.companyName,
    brandDescription: brand.nrDesc,
    showTitle: feed.title,
    showAuthor: feed.author,
    episodeTitle: episode.title,
    episodeDescription: episode.description,
    episodeNumber: episode.episodeNumber,
    seasonNumber: episode.seasonNumber,
    episodeLink: episode.link,
    publishedAt: episode.publishedAt,
    transcript: transcript.text,
  }
  const sharedContext = buildSharedContext(sharedContextArgs)

  // 1. Generate release fields + category + regions
  let fields: ReleaseFields
  try {
    fields = await generateReleaseFields({
      ...sharedContextArgs,
      categories: taxonomy.categories,
      regions: taxonomy.regions,
    })
  } catch (err) {
    return {
      ...baseResult,
      status: 'error',
      error: `Release generation failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // 2. Insert the release
  const releaseUuid = uuidv4().replace(/-/g, '')
  const slug = makeSlug(fields.title)
  const [newRelease] = await db
    .insert(releases)
    .values({
      uuid: releaseUuid,
      userId: feed.userId,
      companyId: feed.companyId,
      title: fields.title.slice(0, 80),
      abstract: fields.abstract,
      body: fields.body,
      pullquote: fields.pullquote || null,
      location: fields.location?.slice(0, 120) || null,
      slug,
      landingPage: episode.link || null,
      status: 'draftnxt',
      editorialHold: false,
      createdAt: new Date(),
    })
    .returning()

  // 3. Link episode -> release
  await db
    .update(podcastEpisodes)
    .set({ releaseId: newRelease.id, updatedAt: new Date() })
    .where(eq(podcastEpisodes.id, episode.id))

  // 4. Attach primary category (validated)
  if (fields.primaryCategoryId) {
    const exists = await db
      .select({ id: categoryTable.id })
      .from(categoryTable)
      .where(eq(categoryTable.id, fields.primaryCategoryId))
      .limit(1)
    if (exists.length > 0) {
      await db.insert(releaseCategories).values({
        releaseId: newRelease.id,
        categoryId: fields.primaryCategoryId,
      })
      categoriesAttached = 1
    } else {
      warnings.push(`AI returned non-existent category id ${fields.primaryCategoryId}`)
    }
  } else {
    warnings.push('No primary category selected')
  }

  // 5. Attach regions (validated)
  if (fields.regionIds.length > 0) {
    const validRegions = await db
      .select({ id: regionTable.id })
      .from(regionTable)
      .where(inArray(regionTable.id, fields.regionIds.slice(0, 5)))
    if (validRegions.length > 0) {
      await db.insert(releaseRegions).values(
        validRegions.map((r) => ({ releaseId: newRelease.id, regionId: r.id })),
      )
      regionsAttached = validRegions.length
    }
    if (validRegions.length < fields.regionIds.length) {
      warnings.push(
        `${fields.regionIds.length - validRegions.length} invalid region id(s) returned by AI`,
      )
    }
  }

  // 6 + 7 + 8: FAQs, banner from podcast image, news image — in parallel
  const tasks: Array<Promise<void>> = []

  if (!options.skipFaqs) {
    tasks.push(
      (async () => {
        try {
          const faqs = await generateFaqs({
            sharedContext,
            releaseTitle: fields.title,
            releaseBody: fields.body,
          })
          if (faqs.length > 0) {
            await db.insert(releaseFaqs).values(
              faqs.map((f, i) => ({
                prId: newRelease.id,
                question: f.question.slice(0, 1000),
                answer: f.answer,
                sortOrder: i,
                createdAt: new Date(),
                updatedAt: new Date(),
              })),
            )
            faqsCreated = faqs.length
          }
        } catch (err) {
          warnings.push(`FAQ generation failed: ${err instanceof Error ? err.message : String(err)}`)
        }
      })(),
    )
  }

  // Pick best artwork URL: prefer the episode-level image, fall back to the show image
  const artworkUrl = episode.imageUrl || feed.imageUrl || null

  if (artworkUrl && !options.skipBanner) {
    tasks.push(
      (async () => {
        try {
          const buf = await fetchImageBuffer(artworkUrl)
          const { url, width, height, filesize } = await uploadPodcastBanner(buf, newRelease.id)
          const [banner] = await db
            .insert(banners)
            .values({
              uuid: randomUUID(),
              userId: feed.userId,
              companyId: feed.companyId,
              url,
              frontPageUrl: url,
              cdnUrl: url,
              title: `${feed.title || 'Podcast'} — ${episode.title || 'Episode'}`.slice(0, 255),
              imgCredits: feed.author?.slice(0, 128) || null,
              width,
              height,
              filesize,
              source: 'podcast-rss',
              sourceLink: (artworkUrl || '').slice(0, 128),
            })
            .returning()
          await db
            .update(releases)
            .set({ bannerId: banner.id })
            .where(eq(releases.id, newRelease.id))
          bannerCreated = true
        } catch (err) {
          warnings.push(
            `Banner generation failed: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })(),
    )
  } else if (!artworkUrl && !options.skipBanner) {
    warnings.push('No artwork URL in feed or episode — banner skipped')
  }

  const useChapterImages = !!episode.chaptersUrl && !options.skipNewsImage

  if (useChapterImages) {
    tasks.push(
      (async () => {
        try {
          const chapterImages = await fetchChapterImages(episode.chaptersUrl as string)
          if (chapterImages.length === 0) {
            warnings.push('Chapter images skipped: chapters JSON had no usable images')
            return
          }
          let firstSucceededImageId: number | null = null
          for (let i = 0; i < chapterImages.length; i++) {
            const ch = chapterImages[i]
            try {
              const buf = await fetchImageBuffer(ch.url)
              const { url, width, height, filesize } = await uploadPRImage(
                buf,
                newRelease.id,
                'primary',
              )
              const [imgRow] = await db
                .insert(images)
                .values({
                  uuid: randomUUID(),
                  userId: feed.userId,
                  companyId: feed.companyId,
                  url,
                  title: (ch.title || `${feed.title || 'Podcast'} — ${episode.title || 'Episode'}`).slice(0, 255),
                  imgCredits: feed.author?.slice(0, 128) || null,
                  width,
                  height,
                  filesize,
                  source: 'podcast-chapters',
                  sourceLink: (episode.chaptersUrl || '').slice(0, 128),
                })
                .returning()
              await db.insert(releaseImages).values({
                releaseId: newRelease.id,
                imageId: imgRow.id,
                sortOrder: chapterImagesCreated,
              })
              if (firstSucceededImageId === null) firstSucceededImageId = imgRow.id
              chapterImagesCreated++
            } catch (err) {
              warnings.push(
                `Chapter image ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`,
              )
            }
          }
          if (firstSucceededImageId !== null) {
            await db
              .update(releases)
              .set({ primaryImageId: firstSucceededImageId })
              .where(eq(releases.id, newRelease.id))
            newsImageCreated = true
          } else {
            warnings.push('Chapter images skipped: all downloads failed')
          }
        } catch (err) {
          warnings.push(
            `Chapter images skipped: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })(),
    )
  } else if (artworkUrl && !options.skipNewsImage) {
    tasks.push(
      (async () => {
        try {
          const buf = await fetchImageBuffer(artworkUrl)
          const { url, width, height, filesize } = await uploadPRImage(buf, newRelease.id, 'primary')
          const [imgRow] = await db
            .insert(images)
            .values({
              uuid: randomUUID(),
              userId: feed.userId,
              companyId: feed.companyId,
              url,
              title: `${feed.title || 'Podcast'} — ${episode.title || 'Episode'}`.slice(0, 255),
              imgCredits: feed.author?.slice(0, 128) || null,
              width,
              height,
              filesize,
              source: 'podcast-rss',
              sourceLink: (artworkUrl || '').slice(0, 128),
            })
            .returning()
          await db.insert(releaseImages).values({
            releaseId: newRelease.id,
            imageId: imgRow.id,
            sortOrder: 0,
          })
          await db
            .update(releases)
            .set({ primaryImageId: imgRow.id })
            .where(eq(releases.id, newRelease.id))
          newsImageCreated = true
        } catch (err) {
          warnings.push(
            `News image creation failed: ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      })(),
    )
  } else if (!artworkUrl && !options.skipNewsImage) {
    warnings.push('No artwork URL in feed or episode — news image skipped')
  }

  await Promise.all(tasks)

  // Notify the user (via whatever channels they enabled) that a draft is ready.
  // Best-effort — failures never block the return.
  try {
    await dispatchNewDraftNotifications({
      feed: {
        uuid: feed.uuid,
        title: feed.title,
        notifyEmail: feed.notifyEmail,
        notifyEmailTo: feed.notifyEmailTo,
        notifySms: feed.notifySms,
        notifySmsPhone: feed.notifySmsPhone,
        notifyInApp: feed.notifyInApp,
        notifySlack: feed.notifySlack,
        notifySlackWebhookUrl: feed.notifySlackWebhookUrl,
      },
      release: { uuid: newRelease.uuid!, title: fields.title.slice(0, 80) },
      episode: { title: episode.title },
    })
  } catch (err) {
    warnings.push(
      `Notification dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  return {
    status: 'created',
    releaseId: newRelease.id,
    releaseUuid: newRelease.uuid!,
    bannerCreated,
    newsImageCreated,
    chapterImagesCreated,
    faqsCreated,
    categoriesAttached,
    regionsAttached,
    warnings,
  }
}
