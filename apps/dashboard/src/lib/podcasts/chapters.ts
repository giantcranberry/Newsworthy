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
