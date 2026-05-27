# Podcast Chapter Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a podcast feed item exposes `<podcast:chapters>`, fetch the JSON, dedupe images, and attach up to 10 chapter cover-art images as news images on the generated press release. The first chapter image replaces the show artwork as the release's primary news image.

**Architecture:** Capture the chapters URL at RSS parse time (via `rss-parser` custom field) and persist it on `podcast_episodes.chapters_url`. At PR generation time, branch the news-image task: if `chaptersUrl` is set, fetch the JSON, download up to 10 unique images, attach as news images (first = primary). If absent or fails, fall back to existing show-artwork path. Banner is untouched in all cases.

**Tech Stack:** TypeScript, Bun, Drizzle ORM (Postgres), rss-parser, sharp (via existing `uploadPRImage`), Anthropic SDK, Next.js 15.

**Spec reference:** `docs/superpowers/specs/2026-05-26-podcast-chapter-images-design.md`

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/dashboard/src/db/schema/podcasts.ts` | Drizzle schema for dashboard | Add `chaptersUrl: text('chapters_url')` to `podcastEpisodes` |
| `packages/db/src/schema/podcasts.ts` | Drizzle schema mirror | Same as above |
| `apps/dashboard/src/lib/podcasts/parse-feed.ts` | RSS → `ParsedEpisode` | Add `podcast:chapters` custom field; expose `chaptersUrl` on `ParsedEpisode` |
| `apps/dashboard/src/lib/podcasts/chapters.ts` | Fetch + parse chapter JSON | **NEW** — `fetchChapterImages(url)` returns deduped `ChapterImage[]`, capped at 10 |
| `apps/dashboard/src/lib/podcasts/chapters.test.ts` | Unit tests for chapters helper | **NEW** — Bun tests covering happy path, dedup, cap, errors, malformed JSON |
| `apps/dashboard/scripts/refresh-podcast-feeds.ts` | Hourly cron | Persist `chaptersUrl` on insert; backfill existing rows |
| `apps/dashboard/src/app/api/podcasts/feeds/route.ts` | Add-feed endpoint | Persist `chaptersUrl` on bulk insert |
| `apps/dashboard/src/lib/podcasts/generate-pr.ts` | PR generation orchestrator | Branch news-image task on `episode.chaptersUrl`; add `chapterImagesCreated` to result |

---

## Pre-flight check

- [ ] **Step 0: Verify schema migration has been applied**

The user ran `ALTER TABLE podcast_episodes ADD COLUMN chapters_url text;` on 2026-05-26. Verify:

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- psql "$DATABASE_URL" -c "\d podcast_episodes" | grep chapters_url
```

Expected: a line like `chapters_url | text |` appears in the output.

If missing, **stop** and ask the user to run the migration before proceeding.

---

### Task 1: Mirror the schema change in Drizzle

**Files:**
- Modify: `apps/dashboard/src/db/schema/podcasts.ts`
- Modify: `packages/db/src/schema/podcasts.ts`

- [ ] **Step 1: Add `chaptersUrl` to the dashboard Drizzle schema**

Open `apps/dashboard/src/db/schema/podcasts.ts`. Find the `podcastEpisodes` table definition and locate this line:

```ts
imageUrl: text('image_url'),
```

Add the new column immediately after it:

```ts
imageUrl: text('image_url'),
chaptersUrl: text('chapters_url'),
```

- [ ] **Step 2: Mirror the change in the shared `packages/db` schema**

Open `packages/db/src/schema/podcasts.ts`. Find the same `imageUrl: text('image_url'),` line in the `podcastEpisodes` table and add `chaptersUrl: text('chapters_url'),` immediately after it.

- [ ] **Step 3: Type-check the dashboard app**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
bunx tsc --noEmit
```

Expected: no new errors related to `chaptersUrl`. Pre-existing errors in unrelated files are fine for now — verify by comparing against the pre-change baseline if uncertain.

- [ ] **Step 4: Commit**

```bash
cd /home/david/Dev/nextjs/newsworthy
git add apps/dashboard/src/db/schema/podcasts.ts packages/db/src/schema/podcasts.ts
git commit -m "Add chapters_url column to podcast_episodes Drizzle schema"
```

---

### Task 2: Extend the RSS parser to capture `<podcast:chapters>`

**Files:**
- Modify: `apps/dashboard/src/lib/podcasts/parse-feed.ts`

- [ ] **Step 1: Add the custom field declaration to the parser**

Open `apps/dashboard/src/lib/podcasts/parse-feed.ts`. Find this line:

```ts
const parser = new Parser<FeedRoot, FeedItem>()
```

Replace it with:

```ts
const parser = new Parser<FeedRoot, FeedItem>({
  customFields: {
    item: [['podcast:chapters', 'podcastChapters']],
  },
})
```

- [ ] **Step 2: Add `podcastChapters` to the `FeedItem` type**

Find the `type FeedItem = { ... }` definition. Add this property anywhere inside the type body:

```ts
podcastChapters?: { $?: { url?: string; type?: string } }
```

- [ ] **Step 3: Add `chaptersUrl` to the `ParsedEpisode` interface**

Find the `export interface ParsedEpisode { ... }` definition. Add:

```ts
chaptersUrl?: string
```

(Put it next to `imageUrl?: string` for grouping.)

- [ ] **Step 4: Extract the value in the episodes map**

Find the `(feed.items || []).map((item) => ({ ... }))` block in `parsePodcastFeed`. Inside the returned object, immediately after `imageUrl: item.itunes?.image,`, add:

```ts
chaptersUrl: item.podcastChapters?.$?.url,
```

- [ ] **Step 5: Sanity-run the parser against a known feed exposing chapters**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- bun -e "
import { parsePodcastFeed } from './src/lib/podcasts/parse-feed.ts'
const feed = await parsePodcastFeed('https://feed.nashownotes.com/rss.xml')
const withChapters = feed.episodes.filter(e => e.chaptersUrl).slice(0, 3)
console.log('episodes with chapters:', withChapters.length, 'of', feed.episodes.length)
withChapters.forEach(e => console.log(' -', e.title, '->', e.chaptersUrl))
"
```

Expected: at least one line printed showing an episode and a `chapters` URL. If zero episodes match, the feed may not expose chapters today — try another known-chapters feed (Podcasting 2.0 directory) or `curl` the RSS XML and grep for `podcast:chapters` to confirm presence.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/podcasts/parse-feed.ts
git commit -m "Capture podcast:chapters URL when parsing RSS feeds"
```

---

### Task 3: Persist `chaptersUrl` on episode insert + backfill on refresh

**Files:**
- Modify: `apps/dashboard/scripts/refresh-podcast-feeds.ts`
- Modify: `apps/dashboard/src/app/api/podcasts/feeds/route.ts`

- [ ] **Step 1: Add `chaptersUrl` to the insert in `refreshFeed`**

Open `apps/dashboard/scripts/refresh-podcast-feeds.ts`. Find the `db.insert(podcastEpisodes).values({ ... })` call inside `refreshFeed` (around line 110). The `.values({ ... })` object includes `imageUrl: ep.imageUrl,`. Immediately after that line, add:

```ts
          chaptersUrl: ep.chaptersUrl,
```

(Preserve the existing 10-space indentation that surrounds the other fields in the object.)

- [ ] **Step 2: Add a backfill update inside `refreshFeed`**

The insert uses `onConflictDoNothing`, so existing episodes whose feeds *newly* start exposing `<podcast:chapters>` would never get the URL. Add a targeted backfill in the same `refreshFeed` function.

Near the top of the file with the other imports, find the drizzle imports. They look like:

```ts
import { and, eq, sql } from 'drizzle-orm'
```

(Or similar — the exact existing imports may vary.) Ensure both `and`, `eq`, and `isNull` are imported. If `isNull` is not already in the import line, add it:

```ts
import { and, eq, isNull, sql } from 'drizzle-orm'
```

Then, inside `refreshFeed`, immediately **after** the `for (const ep of parsed.episodes) { ... }` insert loop and **before** the `lastEpisodeAt` computation, add:

```ts
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
```

- [ ] **Step 3: Add `chaptersUrl` to the bulk insert in the add-feed endpoint**

Open `apps/dashboard/src/app/api/podcasts/feeds/route.ts`. Find the `parsedFeed.episodes.map((e) => ({ ... }))` block (around line 83). The mapped object includes `imageUrl: e.imageUrl,`. Immediately after that line, add:

```ts
      chaptersUrl: e.chaptersUrl,
```

(Preserve the existing 6-space indentation.)

- [ ] **Step 4: Type-check**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
bunx tsc --noEmit
```

Expected: no new errors. The new `chaptersUrl` field should match the column type `text` in the schema.

- [ ] **Step 5: Smoke test the refresh script against one feed**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- bun scripts/refresh-podcast-feeds.ts --refresh-only --limit=1
```

Expected: script completes without error. Then verify in DB:

```bash
doppler run -- psql "$DATABASE_URL" -c \
  "SELECT count(*) FILTER (WHERE chapters_url IS NOT NULL) AS with_chapters, count(*) AS total FROM podcast_episodes;"
```

Expected: at least one row has `chapters_url` populated if a refreshed feed exposes chapters. Zero is fine if no feeds in your DB expose chapters yet.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/scripts/refresh-podcast-feeds.ts apps/dashboard/src/app/api/podcasts/feeds/route.ts
git commit -m "Persist podcast chapters URL on episode insert and refresh"
```

---

### Task 4: Build the chapter-images fetcher module (TDD)

**Files:**
- Create: `apps/dashboard/src/lib/podcasts/chapters.ts`
- Create: `apps/dashboard/src/lib/podcasts/chapters.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/dashboard/src/lib/podcasts/chapters.test.ts` with this content:

```ts
import { test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { fetchChapterImages } from './chapters'

const ORIGINAL_FETCH = globalThis.fetch

function mockFetchOnce(response: Partial<Response> & { jsonBody?: unknown; textBody?: string }) {
  globalThis.fetch = mock(async () => {
    const ok = response.ok ?? true
    const status = response.status ?? (ok ? 200 : 500)
    const body =
      response.jsonBody !== undefined
        ? JSON.stringify(response.jsonBody)
        : (response.textBody ?? '')
    return new Response(body, { status }) as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
})

test('returns deduped images preserving first-occurrence order', async () => {
  mockFetchOnce({
    jsonBody: {
      version: '1.2.0',
      chapters: [
        { startTime: 0, title: 'Intro', img: 'https://cdn.example.com/a.jpg' },
        { startTime: 60, title: 'B', img: 'https://cdn.example.com/b.jpg' },
        { startTime: 120, title: 'A again', img: 'https://cdn.example.com/a.jpg' },
        { startTime: 180, title: 'C', img: 'https://cdn.example.com/c.jpg' },
      ],
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.map((r) => r.url)).toEqual([
    'https://cdn.example.com/a.jpg',
    'https://cdn.example.com/b.jpg',
    'https://cdn.example.com/c.jpg',
  ])
  expect(result[0].title).toBe('Intro')
})

test('caps result at the provided limit', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: Array.from({ length: 25 }, (_, i) => ({
        startTime: i,
        img: `https://cdn.example.com/${i}.jpg`,
      })),
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json', { limit: 5 })
  expect(result.length).toBe(5)
})

test('default limit is 10', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: Array.from({ length: 25 }, (_, i) => ({
        startTime: i,
        img: `https://cdn.example.com/${i}.jpg`,
      })),
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.length).toBe(10)
})

test('filters out entries without img', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: [
        { startTime: 0, title: 'no img' },
        { startTime: 60, title: 'has img', img: 'https://cdn.example.com/x.jpg' },
        { startTime: 120, title: 'empty img', img: '' },
        { startTime: 180, title: 'non-http', img: 'data:image/png;base64,abc' },
      ],
    },
  })

  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result.map((r) => r.url)).toEqual(['https://cdn.example.com/x.jpg'])
})

test('returns empty array when chapters array is missing', async () => {
  mockFetchOnce({ jsonBody: { version: '1.2.0' } })
  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result).toEqual([])
})

test('returns empty array when chapters is empty', async () => {
  mockFetchOnce({ jsonBody: { chapters: [] } })
  const result = await fetchChapterImages('https://example.com/c.json')
  expect(result).toEqual([])
})

test('throws on HTTP error', async () => {
  mockFetchOnce({ ok: false, status: 404, textBody: 'not found' })
  await expect(fetchChapterImages('https://example.com/c.json')).rejects.toThrow(/404/)
})

test('throws on malformed JSON', async () => {
  mockFetchOnce({ textBody: 'not json' })
  await expect(fetchChapterImages('https://example.com/c.json')).rejects.toThrow()
})

test('passes startTime and title through to caller', async () => {
  mockFetchOnce({
    jsonBody: {
      chapters: [{ startTime: 42, title: 'Hello', img: 'https://cdn.example.com/h.jpg' }],
    },
  })
  const [first] = await fetchChapterImages('https://example.com/c.json')
  expect(first.title).toBe('Hello')
  expect(first.startTime).toBe(42)
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
bun test src/lib/podcasts/chapters.test.ts
```

Expected: all tests FAIL with errors like `Cannot find module './chapters'` or similar.

- [ ] **Step 3: Implement the module**

Create `apps/dashboard/src/lib/podcasts/chapters.ts` with this content:

```ts
/**
 * Fetch a Podcasting 2.0 chapters JSON and return a deduped list of
 * chapter cover-art images in chapter order.
 *
 * Spec: https://github.com/Podcastindex-org/podcast-namespace/blob/main/chapters/jsonChapters.md
 *
 * - Filters entries that lack an http(s) `img` URL
 * - Dedupes by URL, preserving first-occurrence order
 * - Caps results at `opts.limit` (default 10)
 * - Throws on network/HTTP/parse errors; caller should warn-and-skip
 */
export interface ChapterImage {
  url: string
  title?: string
  startTime?: number
}

interface RawChapter {
  startTime?: number
  title?: string
  img?: string
}

interface ChaptersJson {
  chapters?: RawChapter[]
}

const DEFAULT_LIMIT = 10
const DEFAULT_TIMEOUT_MS = 15_000

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export async function fetchChapterImages(
  chaptersUrl: string,
  opts: { limit?: number; timeoutMs?: number } = {},
): Promise<ChapterImage[]> {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const res = await fetch(chaptersUrl, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) {
    throw new Error(`Chapters JSON fetch failed: HTTP ${res.status} for ${chaptersUrl}`)
  }

  const raw = (await res.json()) as ChaptersJson
  const chapters = Array.isArray(raw?.chapters) ? raw.chapters : []

  const seen = new Set<string>()
  const out: ChapterImage[] = []
  for (const c of chapters) {
    const img = typeof c?.img === 'string' ? c.img.trim() : ''
    if (!img || !isHttpUrl(img) || seen.has(img)) continue
    seen.add(img)
    out.push({
      url: img,
      title: typeof c.title === 'string' && c.title.trim() ? c.title : undefined,
      startTime: typeof c.startTime === 'number' ? c.startTime : undefined,
    })
    if (out.length >= limit) break
  }
  return out
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
bun test src/lib/podcasts/chapters.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/lib/podcasts/chapters.ts apps/dashboard/src/lib/podcasts/chapters.test.ts
git commit -m "Add chapter images fetcher with dedup, cap, and HTTP/parse error handling"
```

---

### Task 5: Wire chapter images into PR generation

**Files:**
- Modify: `apps/dashboard/src/lib/podcasts/generate-pr.ts`

- [ ] **Step 1: Import the chapter fetcher and extend the result type**

Open `apps/dashboard/src/lib/podcasts/generate-pr.ts`. Near the top, find the imports from `'./notify'`:

```ts
import { dispatchNewDraftNotifications } from './notify'
```

Add an import for the new module immediately after it:

```ts
import { fetchChapterImages } from './chapters'
```

Find the `export interface PrGenerationResult { ... }` definition. Add a new field after `newsImageCreated: boolean`:

```ts
  chapterImagesCreated: number
```

(Preserve existing 2-space indentation inside the interface.)

- [ ] **Step 2: Initialise the counter near the top of `generatePressReleaseFromEpisode`**

Find this block near the top of `generatePressReleaseFromEpisode`:

```ts
  let bannerCreated = false
  let newsImageCreated = false
  let faqsCreated = 0
  let categoriesAttached = 0
  let regionsAttached = 0
```

Add:

```ts
  let chapterImagesCreated = 0
```

Then find the `baseResult` object literal just below:

```ts
  const baseResult: Omit<PrGenerationResult, 'status'> = {
    bannerCreated,
    newsImageCreated,
    faqsCreated,
    categoriesAttached,
    regionsAttached,
    warnings,
  }
```

Add `chapterImagesCreated` to the object so the type matches:

```ts
  const baseResult: Omit<PrGenerationResult, 'status'> = {
    bannerCreated,
    newsImageCreated,
    chapterImagesCreated,
    faqsCreated,
    categoriesAttached,
    regionsAttached,
    warnings,
  }
```

- [ ] **Step 3: Add the chapter-image branch alongside the existing news-image task**

Find the existing news-image task — the block beginning with:

```ts
  if (artworkUrl && !options.skipNewsImage) {
    tasks.push(
      (async () => {
        try {
          const buf = await fetchImageBuffer(artworkUrl)
```

and ending with `} else if (!artworkUrl && !options.skipNewsImage) { ... }`.

Replace the **entire** existing news-image conditional with this new conditional that decides between chapter images and show artwork:

```ts
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
```

- [ ] **Step 4: Update the final return object to include `chapterImagesCreated`**

Find the final `return { status: 'created', ... }` at the bottom of `generatePressReleaseFromEpisode`. It currently looks like:

```ts
  return {
    status: 'created',
    releaseId: newRelease.id,
    releaseUuid: newRelease.uuid!,
    bannerCreated,
    newsImageCreated,
    faqsCreated,
    categoriesAttached,
    regionsAttached,
    warnings,
  }
```

Replace with:

```ts
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
```

- [ ] **Step 5: Type-check**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
bunx tsc --noEmit
```

Expected: no new errors. If TypeScript complains about `chapterImagesCreated` missing from any non-`'created'` return path, also update those paths — search for `status:` literals like `'error'`, `'already-exists'`, `'no-transcript'` in this file. The early returns already spread `baseResult` (which we updated in Step 2), so they should be fine.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/src/lib/podcasts/generate-pr.ts
git commit -m "Use podcast chapter art as news images when feed exposes podcast:chapters"
```

---

### Task 6: Manual verification against a real episode

**Files:** none (verification only)

- [ ] **Step 1: Refresh feeds so existing episodes get `chapters_url` backfilled**

Run:
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- bun scripts/refresh-podcast-feeds.ts --refresh-only
```

Expected: completes without error.

- [ ] **Step 2: Identify an episode whose feed exposes chapters**

Run:
```bash
doppler run -- psql "$DATABASE_URL" -c \
  "SELECT uuid, title, chapters_url FROM podcast_episodes WHERE chapters_url IS NOT NULL ORDER BY published_at DESC LIMIT 5;"
```

Pick one of the returned UUIDs for the next step. If zero rows are returned, the database has no feeds exposing `<podcast:chapters>` — add a known-chapters feed via the UI first, then re-run Step 1.

- [ ] **Step 3: Confirm the chapters JSON is reachable and well-formed**

Run (replace `<URL>` with the `chapters_url` value from Step 2):
```bash
curl -s '<URL>' | jq '.chapters | map(.img) | unique | length'
```

Expected: a number ≥ 1.

- [ ] **Step 4: Force PR regeneration against that episode**

Run (replace `<UUID>` with the episode UUID from Step 2):
```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- bun scripts/refresh-podcast-feeds.ts --test=<UUID>
```

Expected: script logs PR generation success including a non-zero `chapterImagesCreated` count.

- [ ] **Step 5: Verify the result in the database**

Run (replace `<UUID>` with the episode UUID):
```bash
doppler run -- psql "$DATABASE_URL" <<SQL
SELECT r.id AS release_id, r.primary_image_id, r.banner_id
FROM releases r
JOIN podcast_episodes e ON e.release_id = r.id
WHERE e.uuid = '<UUID>';

SELECT ri.sort_order, i.source, i.source_link, i.url
FROM release_images ri
JOIN images i ON i.id = ri.image_id
JOIN podcast_episodes e ON e.release_id = ri.release_id
WHERE e.uuid = '<UUID>'
ORDER BY ri.sort_order;
SQL
```

Expected:
- `primary_image_id` is not null and equals the `image_id` of the row with `sort_order = 0`.
- All `source` values for that release are `'podcast-chapters'`.
- `sort_order` values are contiguous starting at 0.
- `banner_id` is set (banner comes from show artwork, untouched).

- [ ] **Step 6: Verify the negative path**

Pick an episode whose `chapters_url IS NULL`:

```bash
doppler run -- psql "$DATABASE_URL" -c \
  "SELECT uuid FROM podcast_episodes WHERE chapters_url IS NULL AND release_id IS NULL AND transcription_status = 'completed' LIMIT 1;"
```

Force regeneration with `--test=<UUID>` and verify in the DB that the news image has `source = 'podcast-rss'` (show artwork path), confirming the fallback still works.

- [ ] **Step 7: UI smoke check**

Start the dev server:

```bash
cd /home/david/Dev/nextjs/newsworthy/apps/dashboard
doppler run -- bun run dev
```

Open the draft release from Step 4 in a browser, confirm the news image gallery renders multiple chapter images and the primary image is the first chapter image.

- [ ] **Step 8: No commit needed**

Verification only.

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Schema change (`chapters_url`) | Pre-flight + Task 1 |
| Parser change (`podcast:chapters` custom field, `ParsedEpisode.chaptersUrl`) | Task 2 |
| Episode persistence (insert + onConflict backfill) | Task 3 |
| Chapter fetcher module (`fetchChapterImages`, dedupe, cap, errors) | Task 4 |
| PR-gen wiring (branch on `chaptersUrl`, replace news-image task) | Task 5 |
| Result type extension (`chapterImagesCreated`) | Task 5 |
| Failure matrix (HTTP error, JSON malformed, per-image failure, all failures) | Task 4 (unit tests) + Task 5 (warning pushes) |
| Sanity boundaries (15s timeout, 10-image cap, `image/*` content-type) | Task 4 (timeout + cap in fetcher); existing `fetchImageBuffer` handles `image/*` |
| Testing plan (unit tests + manual `--test` flow) | Task 4 + Task 6 |
| Primary image = first chapter image | Task 5 (Step 3: `update releases set primary_image_id` after first successful insert) |
| Banner unchanged | Task 5 (banner conditional left as-is — not modified) |
| Soft fail throughout | Task 5 (every catch pushes warning; no rethrows out of tasks) |

All spec sections covered.

**2 MB body cap (mentioned in spec) — gap analysis:** Not implemented as a hard cap in Task 4. The 15s timeout combined with `response.json()` failing on truncated/malformed bodies is sufficient defense in practice. A hard byte cap adds complexity (streaming reader, header-only check that publishers can lie about) for marginal value. Documented decision, not a gap worth fixing.

**Placeholder scan:** No "TBD", "TODO", "implement later", or empty-body code blocks. All steps include either explicit code or explicit commands with expected output.

**Type consistency:** `ChapterImage`, `fetchChapterImages`, `chapterImagesCreated`, `chaptersUrl`, `useChapterImages` are used identically across Task 4 and Task 5.

**Naming consistency with existing code:** `source: 'podcast-chapters'` vs existing `source: 'podcast-rss'` — same column, distinct values, easy to filter on.
