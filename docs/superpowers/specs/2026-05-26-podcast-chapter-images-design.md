# Podcast PR — Chapter Art as News Images

**Date:** 2026-05-26
**Branch:** `feature/podcastpr`
**Status:** Design approved, ready for implementation plan

## Problem

Some podcast feeds publish a Podcasting 2.0 chapters file alongside each
episode:

```xml
<podcast:chapters
  url="https://example.com/episode-chapters.json"
  type="application/json"/>
```

The referenced JSON contains per-chapter cover art under `chapters[].img`.
Today the Podcast PR pipeline ignores this and uses only the show/episode
artwork as the press release's primary news image — discarding rich
per-episode visuals that the publisher has already produced.

## Goal

When a feed item exposes `<podcast:chapters>`, fetch the JSON, extract the
chapter cover art, and attach those images as news images on the generated
press release — including using the first chapter image as the release's
primary news image.

## Non-goals

- ID3 chapter art (embedded in MP3 files) — punted previously; out of scope.
- Per-chapter timing/title display in the press release UI — only the image
  is consumed; chapter titles may be used as image captions but no timeline
  is rendered.
- Live regeneration when chapter art changes after a release is published.
  Chapter images are captured at generation time and not re-fetched.
- Changes to the banner. Banner always continues to use show/episode
  artwork at 1200×630.

## User-visible behavior

1. User adds a podcast feed whose items expose `<podcast:chapters>`.
2. The hourly refresh script crawls episodes, transcribes audio, and calls
   `generatePressReleaseFromEpisode` per the existing flow.
3. PR generation produces a draft release whose **news image gallery**
   contains up to 10 unique chapter cover-art images, in chapter order.
4. The **first** chapter image (post-dedupe) is the release's primary news
   image (`releases.primary_image_id`).
5. If the chapters URL is absent, the JSON fetch fails, or every image
   download fails, the user sees a draft with no news image (warnings are
   surfaced via existing logging path); the release is still created.

## Architecture

The work splits cleanly across three existing layers plus one new helper:

| Layer | File | Change |
|---|---|---|
| Schema | `podcasts.ts` (×2) + DB | New `chapters_url TEXT` column on `podcast_episodes` |
| Feed parsing | `lib/podcasts/parse-feed.ts` | Capture `podcast:chapters` via rss-parser custom field; surface as `ParsedEpisode.chaptersUrl` |
| Episode persistence | `refresh-podcast-feeds.ts`, `/api/podcasts/feeds` POST | Include `chaptersUrl` on insert and `onConflictDoUpdate` set |
| Chapter fetching (NEW) | `lib/podcasts/chapters.ts` | Pure helper: fetch JSON → dedupe → cap |
| PR generation | `lib/podcasts/generate-pr.ts` | Branch news-image task on presence of `episode.chaptersUrl` |

## Schema change

```sql
ALTER TABLE podcast_episodes
  ADD COLUMN chapters_url text;
```

Migration was applied 2026-05-26. Drizzle schema (mirrored in both
`apps/dashboard/src/db/schema/podcasts.ts` and
`packages/db/src/schema/podcasts.ts`):

```ts
chaptersUrl: text('chapters_url'),
```

No index — never queried by; read per-row at PR-gen time only.

## Parser change

`rss-parser` requires explicit declaration of namespaced elements. Extend
the constructor:

```ts
const parser = new Parser<FeedRoot, FeedItem>({
  customFields: {
    item: [['podcast:chapters', 'podcastChapters']],
  },
})
```

The element has no body, only attributes, so rss-parser exposes them under
`$`:

```ts
podcastChapters?: { $?: { url?: string; type?: string } }
```

The URL is captured regardless of `type` attribute — some publishers use
`application/json+chapters` or omit `type` entirely. Content-shape
validation happens at fetch time, not parse time.

Added to `ParsedEpisode`:

```ts
chaptersUrl?: string
```

Populated as `item.podcastChapters?.$?.url` in the items map.

## Chapter fetcher module

New file: `apps/dashboard/src/lib/podcasts/chapters.ts`.

```ts
export interface ChapterImage {
  url: string
  title?: string
  startTime?: number
}

export async function fetchChapterImages(
  chaptersUrl: string,
  opts?: { limit?: number; timeoutMs?: number }
): Promise<ChapterImage[]>
```

Behavior:

- `fetch(chaptersUrl, { signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000) })`
- Reject with throw if `!res.ok` or response Content-Length exceeds 2 MB
  (sanity cap — real chapter JSONs are kilobytes).
- Parse JSON, accept shape `{ chapters: Array<{ startTime?, title?, img? }> }`.
- Filter to entries where `img` is a non-empty string parsing as an
  absolute http(s) URL.
- Dedupe by `img` URL, preserving first-occurrence order.
- Slice to `opts.limit ?? 10`.
- Return `[]` on benign degenerate cases (missing `chapters`, all entries
  imageless).
- Throw on network/parse/timeout errors so the caller can warn and skip.

## PR-gen wiring

Inside `generatePressReleaseFromEpisode`, after `artworkUrl` is computed:

```ts
const useChapterImages = !!episode.chaptersUrl && !options.skipNewsImage
```

The news-image task is **replaced** (not augmented) by a chapter-image
task when `useChapterImages` is true. Banner task is untouched.

**Chapter-image task:**

```text
for each ChapterImage returned by fetchChapterImages(episode.chaptersUrl):
  fetchImageBuffer(image.url)
  uploadPRImage(buf, releaseId, 'primary')
  INSERT into images (
    source        = 'podcast-chapters',
    source_link   = chaptersUrl.slice(0, 128),
    img_credits   = feed.author?.slice(0, 128) ?? null,
    title         = (image.title || `${feed.title} — ${episode.title}`).slice(0, 255),
    width, height, filesize, url, uuid, userId, companyId
  )
  INSERT into release_images (release_id, image_id, sort_order = i)
after loop:
  UPDATE releases SET primary_image_id = <first successfully inserted image>
```

Each per-image failure pushes a warning and continues to the next.
`chapterImagesCreated` counter is bumped per success.

If chapters URL is absent, the existing show-artwork news-image task runs
unchanged.

## Result type extension

`PrGenerationResult` gains one field:

```ts
chapterImagesCreated: number  // 0 when path not taken or all failed
```

## Failure matrix

| Condition | Behavior |
|---|---|
| `episode.chapters_url IS NULL` | Existing show-artwork news image runs. No warning. |
| Chapters fetch HTTP error / timeout / oversize | Warning `Chapter images skipped: <reason>`. **No fallback** to show artwork. Release still created. |
| JSON parses, but `chapters` array missing/empty | Same warning path. |
| Subset of image downloads fail | Per-image warnings. Surviving images kept; first survivor becomes primary. |
| All image downloads fail | Warning `Chapter images skipped: all downloads failed`. Release created without news image. |

Soft-fail throughout matches the existing banner/news-image patterns in
`generate-pr.ts`.

## Sanity boundaries

- 15 s timeout on chapters JSON fetch
- 2 MB max JSON body
- 10-image cap (dedupe by URL, preserve chapter order)
- Existing `fetchImageBuffer` validates `content-type: image/*`
- Existing `uploadPRImage` runs `sharp` (will throw on non-image bytes)

## Testing

No unit-test harness exists for the podcast feature yet. Verification is
via the existing `--test=<uuid>` flag on `refresh-podcast-feeds.ts`.

1. **Confirm chapters element is in the feed** — `curl` the RSS, grep
   `podcast:chapters` for the target item.
2. **Confirm chapters JSON is well-formed** — `curl` the chapters URL,
   inspect for `chapters[].img`.
3. **Force PR regeneration** with `--test=<uuid>`.
4. **DB verification:**

```sql
SELECT primary_image_id, banner_id FROM releases WHERE id = <id>;

SELECT ri.sort_order, i.source, i.source_link, i.url
FROM release_images ri JOIN images i ON i.id = ri.image_id
WHERE ri.release_id = <id> ORDER BY ri.sort_order;
```

Expect `source = 'podcast-chapters'`, sort_order 0..N, `primary_image_id`
equal to the sort_order=0 image.

5. **Negative case** — pick an episode where `chapters_url IS NULL`,
   regenerate, confirm show-artwork news image still attaches.
6. **UI smoke** — open the draft release, confirm gallery renders.

If unit tests on `fetchChapterImages` are desired (deterministic; fixture
JSONs are easy), add `apps/dashboard/src/lib/podcasts/chapters.test.ts`
with `bun:test`.

## Open questions

None — design fully resolved through brainstorming on 2026-05-26.

## Decisions recap

| Question | Decision |
|---|---|
| Image cap | First 10 unique (dedupe by URL, chapter order) |
| When to fetch | At PR generation time |
| Primary image | First chapter image replaces show artwork as primary |
| Failure mode | Soft fail — warning only, release still created |
| Fallback to show artwork on failure | **No** — keeps task wiring simple; can revisit |
| Storage of chapters URL | New `podcast_episodes.chapters_url` column |
