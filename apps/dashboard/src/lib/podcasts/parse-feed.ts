import Parser from 'rss-parser'

export interface ParsedEpisode {
  guid: string
  title?: string
  description?: string
  audioUrl?: string
  audioType?: string
  audioLengthBytes?: number
  durationSeconds?: number
  episodeNumber?: number
  seasonNumber?: number
  episodeType?: string
  imageUrl?: string
  chaptersUrl?: string
  link?: string
  publishedAt?: Date
  explicit?: boolean
}

export interface ParsedFeed {
  title: string
  description?: string
  imageUrl?: string
  author?: string
  language?: string
  link?: string
  itunesCategory?: string
  episodes: ParsedEpisode[]
}

type ItunesItem = {
  duration?: string | number
  episode?: string | number
  season?: string | number
  episodeType?: string
  explicit?: string | boolean
  image?: string
  summary?: string
}

type FeedItem = {
  guid?: string
  link?: string
  title?: string
  pubDate?: string
  isoDate?: string
  content?: string
  contentSnippet?: string
  summary?: string
  enclosure?: { url?: string; type?: string; length?: string }
  itunes?: ItunesItem
  podcastChapters?: { $?: { url?: string; type?: string } }
}

type FeedRoot = {
  title?: string
  description?: string
  language?: string
  link?: string
  image?: { url?: string }
  itunes?: {
    author?: string
    image?: string
    category?: string | string[]
    categories?: string[]
    summary?: string
    owner?: { name?: string; email?: string }
  }
  items: FeedItem[]
}

const parser = new Parser<FeedRoot, FeedItem>({
  customFields: {
    item: [['podcast:chapters', 'podcastChapters']],
  },
})

function parseDuration(raw: string | number | undefined): number | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'number') return Math.max(0, Math.floor(raw))
  const s = String(raw).trim()
  if (!s) return undefined
  if (/^\d+$/.test(s)) return parseInt(s, 10)
  const parts = s.split(':').map((p) => parseInt(p, 10))
  if (parts.some(Number.isNaN)) return undefined
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return undefined
}

function parseInteger(raw: string | number | undefined): number | undefined {
  if (raw == null) return undefined
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) ? n : undefined
}

function parseBoolean(raw: string | boolean | undefined): boolean | undefined {
  if (raw == null) return undefined
  if (typeof raw === 'boolean') return raw
  const s = String(raw).trim().toLowerCase()
  if (['true', 'yes', '1', 'explicit'].includes(s)) return true
  if (['false', 'no', '0', 'clean'].includes(s)) return false
  return undefined
}

function extractCategory(feed: FeedRoot): string | undefined {
  const c = feed.itunes?.category
  if (Array.isArray(c)) return c[0]
  if (typeof c === 'string') return c
  if (feed.itunes?.categories?.length) return feed.itunes.categories[0]
  return undefined
}

export async function parsePodcastFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url)

  const episodes: ParsedEpisode[] = (feed.items || []).map((item) => ({
    guid: item.guid || item.enclosure?.url || item.link || `${item.title || ''}-${item.pubDate || ''}`,
    title: item.title,
    description: item.content || item.contentSnippet || item.summary || item.itunes?.summary,
    audioUrl: item.enclosure?.url,
    audioType: item.enclosure?.type,
    audioLengthBytes: item.enclosure?.length ? parseInteger(item.enclosure.length) : undefined,
    durationSeconds: parseDuration(item.itunes?.duration),
    episodeNumber: parseInteger(item.itunes?.episode),
    seasonNumber: parseInteger(item.itunes?.season),
    episodeType: item.itunes?.episodeType,
    imageUrl: item.itunes?.image,
    chaptersUrl: item.podcastChapters?.$?.url,
    link: item.link,
    publishedAt: item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : undefined,
    explicit: parseBoolean(item.itunes?.explicit),
  }))

  return {
    title: feed.title || '(untitled feed)',
    description: feed.description || feed.itunes?.summary,
    imageUrl: feed.itunes?.image || feed.image?.url,
    author: feed.itunes?.author || feed.itunes?.owner?.name,
    language: feed.language,
    link: feed.link,
    itunesCategory: extractCategory(feed),
    episodes,
  }
}
