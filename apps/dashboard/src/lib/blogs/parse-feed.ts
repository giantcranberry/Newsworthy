import Parser from 'rss-parser'

export interface ParsedPost {
  guid: string
  title?: string
  summary?: string
  content?: string
  link?: string
  imageUrl?: string
  author?: string
  publishedAt?: Date
}

export interface ParsedFeed {
  title: string
  description?: string
  imageUrl?: string
  author?: string
  language?: string
  link?: string
  category?: string
  posts: ParsedPost[]
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
  creator?: string
  author?: string
  enclosure?: { url?: string; type?: string; length?: string }
  mediaContent?: { $?: { url?: string; type?: string } } | Array<{ $?: { url?: string; type?: string } }>
  itunes?: { image?: string; summary?: string; author?: string }
  categories?: string[]
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
    owner?: { name?: string }
  }
  items: FeedItem[]
}

const parser = new Parser<FeedRoot, FeedItem>({
  customFields: {
    item: [
      ['dc:creator', 'creator'],
      ['media:content', 'mediaContent', { keepArray: true }],
    ],
  },
})

function firstImage(item: FeedItem): string | undefined {
  const media = item.mediaContent
  const mediaList = Array.isArray(media) ? media : media ? [media] : []
  for (const entry of mediaList) {
    const url = entry?.$?.url
    const type = entry?.$?.type || ''
    if (url && (type === '' || type.startsWith('image'))) return url
  }
  if (item.enclosure?.url && (item.enclosure.type || '').startsWith('image')) {
    return item.enclosure.url
  }
  if (item.itunes?.image) return item.itunes.image
  const html = item.content || ''
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  return match?.[1]
}

function extractCategory(feed: FeedRoot, items: FeedItem[]): string | undefined {
  const c = feed.itunes?.category
  if (Array.isArray(c) && c[0]) return c[0]
  if (typeof c === 'string' && c) return c
  if (feed.itunes?.categories?.[0]) return feed.itunes.categories[0]
  return items.find((i) => i.categories?.length)?.categories?.[0]
}

export async function parseBlogFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url)
  const items = feed.items || []

  const posts: ParsedPost[] = items.map((item) => {
    const content = item.content || item.summary || item.contentSnippet || item.itunes?.summary
    const summary = item.contentSnippet || item.itunes?.summary || item.summary
    return {
      guid: item.guid || item.link || `${item.title || ''}-${item.pubDate || ''}`,
      title: item.title,
      summary,
      content,
      link: item.link,
      imageUrl: firstImage(item),
      author: item.creator || item.author || item.itunes?.author,
      publishedAt: item.isoDate
        ? new Date(item.isoDate)
        : item.pubDate
          ? new Date(item.pubDate)
          : undefined,
    }
  })

  return {
    title: feed.title || '(untitled feed)',
    description: feed.description || feed.itunes?.summary,
    imageUrl: feed.itunes?.image || feed.image?.url,
    author: feed.itunes?.author || feed.itunes?.owner?.name,
    language: feed.language,
    link: feed.link,
    category: extractCategory(feed, items),
    posts,
  }
}
