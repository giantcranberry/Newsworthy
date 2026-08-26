import type { CrawlerVisitor } from '@nwai/db'

type BotMatch = {
  name: string
  pattern: RegExp
}

/** AI training / answer-engine crawlers — checked before SEO so Extended variants win. */
const AI_BOTS: BotMatch[] = [
  { name: 'GPTBot', pattern: /gptbot/i },
  { name: 'ChatGPT-User', pattern: /chatgpt-user/i },
  { name: 'OAI-SearchBot', pattern: /oai-searchbot/i },
  { name: 'ClaudeBot', pattern: /claudebot|anthropic-ai|claude-web/i },
  { name: 'Claude-SearchBot', pattern: /claude-searchbot/i },
  { name: 'Claude-User', pattern: /claude-user/i },
  { name: 'Google-Extended', pattern: /google-extended/i },
  { name: 'Google-CloudVertexBot', pattern: /google-cloudvertexbot/i },
  { name: 'Applebot-Extended', pattern: /applebot-extended/i },
  { name: 'Bytespider', pattern: /bytespider/i },
  { name: 'CCBot', pattern: /ccbot/i },
  {
    name: 'Meta-ExternalAgent',
    pattern: /meta-externalagent|facebookbot|meta-externalfetcher/i,
  },
  { name: 'PerplexityBot', pattern: /perplexitybot/i },
  { name: 'Perplexity-User', pattern: /perplexity-user/i },
  { name: 'Diffbot', pattern: /diffbot/i },
  { name: 'Cohere', pattern: /cohere-ai/i },
  { name: 'Amazonbot', pattern: /amazonbot/i },
  { name: 'YouBot', pattern: /youbot/i },
  { name: 'AI2Bot', pattern: /ai2bot/i },
  { name: 'Firecrawl', pattern: /firecrawlagent|firecrawl/i },
]

/** Classic search-index crawlers */
const SEO_BOTS: BotMatch[] = [
  { name: 'Googlebot', pattern: /googlebot/i },
  { name: 'Bingbot', pattern: /bingbot|msnbot|adidxbot/i },
  { name: 'Slurp', pattern: /slurp/i },
  { name: 'DuckDuckBot', pattern: /duckduckbot/i },
  { name: 'YandexBot', pattern: /yandex(bot|images|accessibility)/i },
  { name: 'Baiduspider', pattern: /baiduspider/i },
  { name: 'Applebot', pattern: /applebot/i },
  { name: 'SemrushBot', pattern: /semrushbot/i },
  { name: 'AhrefsBot', pattern: /ahrefsbot/i },
  { name: 'DotBot', pattern: /dotbot/i },
  { name: 'MJ12bot', pattern: /mj12bot/i },
  { name: 'PetalBot', pattern: /petalbot/i },
  { name: 'Sogou', pattern: /sogou/i },
]

function matchBot(ua: string, bots: BotMatch[]) {
  for (const bot of bots) {
    if (bot.pattern.test(ua)) return bot.name
  }
  return null
}

/** Pull a readable bot token from an unrecognized crawler UA. */
function extractBotNameFromUa(ua: string): string {
  const named = ua.match(
    /([A-Za-z][\w.-]*(?:bot|spider|crawler|crawl|slurp|fetcher)[\w.-]*)/i,
  )
  if (named?.[1]) return named[1].slice(0, 120)

  const compatible = ua.match(/compatible;\s*([^;/)]+)/i)
  if (compatible?.[1]) return compatible[1].trim().slice(0, 120)

  return ua.slice(0, 120)
}

export function classifyUserAgent(userAgent: string | null | undefined): {
  visitor: CrawlerVisitor
  botName: string | null
} {
  const ua = userAgent?.trim() ?? ''
  if (!ua) return { visitor: 'other', botName: null }

  const aiName = matchBot(ua, AI_BOTS)
  if (aiName) return { visitor: 'ai', botName: aiName }

  const seoName = matchBot(ua, SEO_BOTS)
  if (seoName) return { visitor: 'seo', botName: seoName }

  if (/bot|spider|crawler|crawl|slurp|fetcher/i.test(ua)) {
    return { visitor: 'other', botName: extractBotNameFromUa(ua) }
  }

  return { visitor: 'browser', botName: null }
}
