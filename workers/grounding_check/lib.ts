/**
 * Shared AI search grounding helpers.
 * Positive citation hosts: newsworthy.ai, citybuzz.co, streetinsider.com, finance.yahoo.com
 */

export const POSITIVE_HOST_SUFFIXES = [
  'newsworthy.ai',
  'citybuzz.co',
  'streetinsider.com',
] as const

export type ProviderId = 'google_ai_overview' | 'openai' | 'perplexity'

export type ProviderResult = {
  provider: ProviderId
  ok: boolean
  skipped?: boolean
  skipReason?: string
  error?: string
  answerPreview?: string
  citations: string[]
  positiveHits: string[]
  grounded: boolean
}

export function env(...keys: string[]) {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v) return v
  }
  return null
}

export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

/** Citation counts as a positive grounding hit for our distribution network. */
export function isPositiveCitation(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./i, '').toLowerCase()
    for (const suffix of POSITIVE_HOST_SUFFIXES) {
      if (host === suffix || host.endsWith(`.${suffix}`)) return true
    }
    if (host === 'finance.yahoo.com') return true
    if (
      host === 'yahoo.com' &&
      u.pathname.toLowerCase().startsWith('/finance')
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function collectUrls(value: unknown, into: Set<string>, depth = 0) {
  if (depth > 12 || value == null) return
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) into.add(value.split('#')[0]!)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, into, depth + 1)
    return
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase()
      if (
        key.includes('url') ||
        key.includes('uri') ||
        key === 'href' ||
        key === 'link' ||
        key === 'citations' ||
        key === 'sources'
      ) {
        collectUrls(v, into, depth + 1)
      } else if (typeof v === 'object') {
        collectUrls(v, into, depth + 1)
      }
    }
  }
}

export function previewText(text: string, max = 280) {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

export function newsArticleUrl(input: {
  id: number
  slug: string
  releasedAt: Date
  origin?: string
}): string {
  const releasedAt = input.releasedAt
  const year = releasedAt.getFullYear()
  const month = (releasedAt.getMonth() + 1).toString().padStart(2, '0')
  const day = releasedAt.getDate().toString().padStart(2, '0')
  const rawOrigin = input.origin || env('GROUNDING_SITE_ORIGIN') || env('WEBSITE_URL') || 'https://www.newsworthy.ai'
  // Local dashboard/website URLs are useless for public AI search grounding
  const origin = (/localhost|127\.0\.0\.1/i.test(rawOrigin)
    ? 'https://www.newsworthy.ai'
    : rawOrigin
  ).replace(/\/$/, '')
  return `${origin}/news/${year}${month}${day}${input.id}/${input.slug}`
}

export function isPositiveReference(ref: {
  link?: string
  source?: string
  title?: string
}): boolean {
  if (ref.link && isPositiveCitation(ref.link)) return true
  const label = `${ref.source || ''} ${ref.title || ''} ${ref.link || ''}`
  return /newsworthy\.ai|citybuzz\.co|streetinsider\.com|finance\.yahoo\.com/i.test(
    label,
  )
}

export async function queryGoogleAiOverview(
  query: string,
): Promise<ProviderResult> {
  const apiKey = env('SERPAPI_API_KEY', 'SERP_API_KEY')
  if (!apiKey) {
    return {
      provider: 'google_ai_overview',
      ok: false,
      skipped: true,
      skipReason: 'Set SERPAPI_API_KEY (SerpApi Google AI Overview)',
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }

  try {
    const searchUrl = new URL('https://serpapi.com/search.json')
    searchUrl.searchParams.set('engine', 'google')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('api_key', apiKey)
    searchUrl.searchParams.set('hl', 'en')
    searchUrl.searchParams.set('gl', env('SERPAPI_GL') || 'us')
    searchUrl.searchParams.set('no_cache', 'true')
    const location = env('SERPAPI_LOCATION') || 'Austin, Texas, United States'
    if (location) searchUrl.searchParams.set('location', location)

    const searchRes = await fetch(searchUrl)
    const searchData = (await searchRes.json()) as {
      error?: string
      ai_overview?: {
        page_token?: string
        serpapi_link?: string
        references?: { link?: string; source?: string; title?: string }[]
        text_blocks?: unknown
      }
    }

    if (!searchRes.ok || searchData.error) {
      return {
        provider: 'google_ai_overview',
        ok: false,
        error: searchData.error || `SerpApi search failed (${searchRes.status})`,
        citations: [],
        positiveHits: [],
        grounded: false,
      }
    }

    let overview = searchData.ai_overview
    if (!overview) {
      return {
        provider: 'google_ai_overview',
        ok: true,
        answerPreview: '(no AI Overview for this query)',
        citations: [],
        positiveHits: [],
        grounded: false,
      }
    }

    // Always resolve page_token — initial payload often has no/partial references
    if (overview.page_token) {
      const followUrl = overview.serpapi_link
        ? new URL(overview.serpapi_link)
        : (() => {
            const u = new URL('https://serpapi.com/search.json')
            u.searchParams.set('engine', 'google_ai_overview')
            u.searchParams.set('page_token', overview.page_token!)
            u.searchParams.set('api_key', apiKey)
            return u
          })()
      if (!followUrl.searchParams.get('api_key')) {
        followUrl.searchParams.set('api_key', apiKey)
      }

      const followRes = await fetch(followUrl)
      const followData = (await followRes.json()) as {
        error?: string
        ai_overview?: typeof overview
        references?: { link?: string; source?: string; title?: string }[]
        text_blocks?: unknown
      }
      if (!followRes.ok || followData.error) {
        return {
          provider: 'google_ai_overview',
          ok: false,
          error:
            followData.error ||
            `SerpApi AI Overview follow-up failed (${followRes.status})`,
          citations: [],
          positiveHits: [],
          grounded: false,
        }
      }
      overview = followData.ai_overview || {
        references: followData.references,
        text_blocks: followData.text_blocks,
      }
    }

    const urls = new Set<string>()
    const positiveHits: string[] = []
    for (const ref of overview.references || []) {
      if (ref.link) urls.add(ref.link)
      if (isPositiveReference(ref)) {
        positiveHits.push(ref.link || ref.source || ref.title || 'newsworthy')
      }
    }
    collectUrls(overview, urls)

    const citations = [...urls]
    const answerBits: string[] = []
    if (Array.isArray(overview.text_blocks)) {
      for (const block of overview.text_blocks as {
        snippet?: string
        title?: string
      }[]) {
        if (block.snippet) answerBits.push(block.snippet)
        else if (block.title) answerBits.push(block.title)
      }
    }

    return {
      provider: 'google_ai_overview',
      ok: true,
      answerPreview: previewText(answerBits.join(' ') || '(AI Overview present)'),
      citations,
      positiveHits: [...new Set(positiveHits)],
      grounded: positiveHits.length > 0,
    }
  } catch (err) {
    return {
      provider: 'google_ai_overview',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }
}

/** @deprecated Gemini API grounding — not the same as Google AI Overviews */
export async function queryGoogle(query: string): Promise<ProviderResult> {
  return queryGoogleAiOverview(query)
}

export async function queryOpenAI(query: string): Promise<ProviderResult> {
  const apiKey = env('OPENAI_KEY', 'OPENAI_API_KEY')
  if (!apiKey) {
    return {
      provider: 'openai',
      ok: false,
      skipped: true,
      skipReason: 'Set OPENAI_KEY (or OPENAI_API_KEY)',
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }

  const model = env('OPENAI_GROUNDING_MODEL') || 'gpt-4.1-mini'

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        tools: [{ type: 'web_search' }],
        input: query,
      }),
    })
    const data = (await res.json()) as Record<string, unknown>
    if (!res.ok) {
      return {
        provider: 'openai',
        ok: false,
        error: JSON.stringify(data).slice(0, 500),
        citations: [],
        positiveHits: [],
        grounded: false,
      }
    }

    const urls = new Set<string>()
    collectUrls(data, urls)

    let outputText = ''
    if (typeof data.output_text === 'string') {
      outputText = data.output_text
    } else if (Array.isArray(data.output)) {
      for (const item of data.output as {
        type?: string
        content?: { type?: string; text?: string; annotations?: unknown[] }[]
      }[]) {
        if (item.type !== 'message' || !item.content) continue
        for (const part of item.content) {
          if (part.type === 'output_text' && part.text) outputText += part.text
          collectUrls(part.annotations, urls)
        }
      }
    }

    const citations = [...urls]
    const positiveHits = citations.filter(isPositiveCitation)

    return {
      provider: 'openai',
      ok: true,
      answerPreview: previewText(outputText || '(no text)'),
      citations,
      positiveHits,
      grounded: positiveHits.length > 0,
    }
  } catch (err) {
    return {
      provider: 'openai',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }
}

export async function queryPerplexity(query: string): Promise<ProviderResult> {
  const apiKey = env('PERPLEXITY_API_KEY')
  if (!apiKey) {
    return {
      provider: 'perplexity',
      ok: false,
      skipped: true,
      skipReason: 'Set PERPLEXITY_API_KEY',
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }

  const model = env('PERPLEXITY_MODEL') || 'sonar'

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'Answer using live web search. Cite primary news sources with URLs when possible.',
          },
          { role: 'user', content: query },
        ],
      }),
    })
    const data = (await res.json()) as {
      error?: unknown
      citations?: string[]
      search_results?: { url?: string }[]
      choices?: { message?: { content?: string } }[]
    }
    if (!res.ok) {
      return {
        provider: 'perplexity',
        ok: false,
        error: JSON.stringify(data).slice(0, 500),
        citations: [],
        positiveHits: [],
        grounded: false,
      }
    }

    const urls = new Set<string>()
    for (const c of data.citations || []) urls.add(c)
    for (const s of data.search_results || []) {
      if (s.url) urls.add(s.url)
    }
    collectUrls(data, urls)

    const citations = [...urls]
    const positiveHits = citations.filter(isPositiveCitation)
    const answer = data.choices?.[0]?.message?.content || ''

    return {
      provider: 'perplexity',
      ok: true,
      answerPreview: previewText(answer),
      citations,
      positiveHits,
      grounded: positiveHits.length > 0,
    }
  } catch (err) {
    return {
      provider: 'perplexity',
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      citations: [],
      positiveHits: [],
      grounded: false,
    }
  }
}

export const PROVIDER_RUNNERS: Record<
  ProviderId,
  (q: string) => Promise<ProviderResult>
> = {
  google_ai_overview: queryGoogleAiOverview,
  openai: queryOpenAI,
  perplexity: queryPerplexity,
}

/** Accept CLI aliases like `google` → `google_ai_overview`. */
export function parseProviderList(raw: string): ProviderId[] {
  return raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .map((p) => (p === 'google' ? 'google_ai_overview' : p))
    .filter((p): p is ProviderId =>
      p === 'google_ai_overview' || p === 'openai' || p === 'perplexity',
    )
}

export const DEFAULT_PROVIDERS: ProviderId[] = [
  'google_ai_overview',
  'openai',
  'perplexity',
]

/** Use gpt-4o-mini to invent a distinctive web-search query from DB release fields. */
export async function deviseUniqueQuery(input: {
  title: string
  abstract?: string | null
  body?: string | null
}): Promise<string> {
  const apiKey = env('OPENAI_KEY', 'OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_KEY required to devise grounding queries')

  const bodySnippet = (input.body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content: [
            'You invent a short, distinctive web-search query that would retrieve ONE specific press release/news article.',
            'Use uncommon proper nouns, product names, dollar amounts, dates, or quoted phrases from the copy.',
            'Do not include site names (newsworthy, citybuzz, streetinsider, yahoo).',
            'Do not wrap in quotes unless a short exact phrase is essential.',
            'Return ONLY the query string — no explanation.',
          ].join(' '),
        },
        {
          role: 'user',
          content: [
            `Title: ${input.title}`,
            input.abstract ? `Abstract: ${input.abstract.slice(0, 500)}` : '',
            bodySnippet ? `Body excerpt: ${bodySnippet}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      ],
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!res.ok) {
    throw new Error(data.error?.message || `gpt-4o-mini failed (${res.status})`)
  }

  const raw = data.choices?.[0]?.message?.content?.trim() || ''
  const query = raw
    .replace(/^["']|["']$/g, '')
    .replace(/^query:\s*/i, '')
    .trim()
  if (!query) throw new Error('gpt-4o-mini returned an empty query')
  return query.slice(0, 500)
}
