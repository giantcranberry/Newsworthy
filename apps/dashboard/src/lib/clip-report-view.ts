import type { ReportData, CrawlerStats } from '@/services/report'

/*
 * What the clipping report shows, derived from ReportData. The web report
 * (pr/clips/[uuid]/clips-report.tsx), the PDF and the XLS export all build their
 * lists, links and chart series from here so the three stay in sync.
 */

export interface ReportLinkItem {
  name: string
  link: string | null
  logo: string
}

export interface CircuitItem {
  circuit: 'HR' | 'Cannabis'
  name: string
  link: string
  city: string
  state: string
  thumbnail: string
}

export interface ActivitySeries {
  key: 'views' | 'shares' | 'aiTraining' | 'aiGrounding' | 'seo'
  label: string
  color: string
  values: number[]
}

export const ENHANCED_DISPLAY_LIMIT = 48
export const ENHANCED_TOTAL_ENDPOINTS = 330

const ACTIVITY_MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

type CrawlerActivityField = 'aiTraining' | 'aiGrounding' | 'seo'

function labelsAreHourly(labels: string[]) {
  return labels.some((label) => /^\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}\s*(AM|PM)$/i.test(label))
}

export function crawlerSeriesForLabels(
  labels: string[],
  activity: CrawlerStats['activity'] | undefined,
  daily: CrawlerStats['daily'],
  field: CrawlerActivityField,
): number[] {
  if (activity && activity.length > 0) {
    const byLabel = new Map(activity.map((bucket) => [bucket.label, bucket[field]]))
    return labels.map((label) => byLabel.get(label) ?? 0)
  }
  if (labelsAreHourly(labels)) return labels.map(() => 0)
  const byDay = new Map<string, number>()
  const byMonth = new Map<string, number>()
  for (const bucket of daily) {
    const [y, m, day] = bucket.date.split('-')
    if (!y || !m || !day) continue
    const total = bucket[field]
    byDay.set(`${m}/${day}/${y}`, (byDay.get(`${m}/${day}/${y}`) || 0) + total)
    const monthKey = `${ACTIVITY_MONTHS[Number(m)]} ${y}`
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + total)
  }
  return labels.map((label) => byDay.get(label) ?? byMonth.get(label) ?? 0)
}

export function seriesSum(values: number[]) {
  return values.reduce((sum, n) => sum + n, 0)
}

/**
 * The "Daily Activity" chart: views, shares and crawler fetches per bucket, keeping
 * only series with data. Empty when the chart is hidden (release over a year old).
 */
export function dailyActivity(data: ReportData): { labels: string[]; series: ActivitySeries[] } {
  const labels = data.combStats.map((s) => s.key_as_string)
  if (data.releaseIsYearOld || labels.length === 0) return { labels: [], series: [] }
  const crawler = data.crawlerStats
  const crawlerSeries = (field: CrawlerActivityField) =>
    crawler ? crawlerSeriesForLabels(labels, crawler.activity, crawler.daily, field) : labels.map(() => 0)
  const series: ActivitySeries[] = [
    { key: 'views', label: 'Views', color: '#3b82f6', values: data.combStats.map((s) => s.views) },
    { key: 'shares', label: 'Shares', color: '#22c55e', values: data.combStats.map((s) => s.shares) },
    { key: 'aiTraining', label: 'AI Training', color: '#a855f7', values: crawlerSeries('aiTraining') },
    { key: 'aiGrounding', label: 'AI Grounding', color: '#f97316', values: crawlerSeries('aiGrounding') },
    { key: 'seo', label: 'SEO', color: '#6366f1', values: crawlerSeries('seo') },
  ]
  return { labels, series: series.filter((s) => seriesSum(s.values) > 0) }
}

/** The AI & Search Visibility cards that are shown (only groups with fetches) */
export function visibilityGroups(data: ReportData) {
  const stats = data.crawlerStats
  if (!stats) return []
  return [
    { key: 'aiTraining' as const, label: 'AI Training', group: stats.aiTraining },
    { key: 'aiGrounding' as const, label: 'AI Grounding', group: stats.aiGrounding },
    { key: 'seo' as const, label: 'SEO Indexing', group: stats.seo },
  ].filter((g) => g.group.total > 0)
}

export function hasVisibilityData(data: ReportData) {
  return visibilityGroups(data).length > 0 || (data.aiGrounding?.citations.length ?? 0) > 0
}

/** 'YYYY/MM/DD' path segment CityBuzz uses in its URLs */
export function cityBuzzDate(releasedAt: string | null) {
  if (!releasedAt) return ''
  const d = new Date(releasedAt)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

export function searchPortals(data: ReportData): ReportLinkItem[] {
  const { encodedTitle, release, clips, yahooFinanceUrls } = data
  return [
    { name: 'Google', link: `https://google.com/search?q=${encodedTitle}`, logo: '/img/logos/google.png' },
    { name: 'Microsoft Bing', link: `https://bing.com/search?q=${encodedTitle}`, logo: '/img/logos/microsoft.jpg' },
    { name: 'DuckDuckGo', link: `https://duckduckgo.com/?q=${encodedTitle}&t=h_&ia=web`, logo: 'https://cdn.newsramp.app/logos/duckduckgo.png' },
    { name: 'CityBuzz', link: `https://www.citybuzz.co/${cityBuzzDate(release.releasedAt)}/${release.slug}/`, logo: '/img/logos/citybuzz.png' },
    ...yahooFinanceUrls.map((url) => ({ name: 'Yahoo Finance', link: url, logo: 'https://cdn.newsramp.app/newsworthy/yahoo_news_1.jpg' })),
    { name: 'StreetInsider', link: clips.streetinsiderUrl || 'https://www.streetinsider.com/Newsworthy', logo: 'https://us-southeast-1.linodeobjects.com/cdn.newsramp.app/nwai-assets/1786077136988-streetinsider.png' },
    { name: 'Ground News', link: `https://ground.news/article/${release.slug}`, logo: 'https://cdn.newsramp.app/logos/Ground_News.png' },
  ]
}

export const RESEARCH_DATABASES: ReportLinkItem[] = [
  { name: 'Gale', link: 'https://www.gale.com', logo: 'https://cdn.newsramp.app/images/clip_report/gale.png' },
  { name: 'LexisNexis', link: 'https://www.lexisnexis.com/en-us/gateway.page', logo: 'https://cdn.newsramp.app/images/clip_report/lexis-nexis.png' },
  { name: "Moody's Analytics", link: 'https://www.moodysanalytics.com', logo: 'https://cdn.newsramp.app/images/clip_report/moodys.png' },
  { name: 'ProQuest', link: 'https://www.proquest.com', logo: 'https://cdn.newsramp.app/images/clip_report/pro-quest.png' },
  { name: 'Refinitiv / LSEG', link: 'https://www.lseg.com/en/data-analytics', logo: 'https://cdn.newsramp.app/images/clip_report/refinitive.png' },
  { name: 'Thomson Reuters', link: 'https://www.thomsonreuters.com/en.html', logo: 'https://cdn.newsramp.app/images/clip_report/thomson-reuters.png' },
]

/** Placements and social posts in the Newsramp Boostify circuit, in display order */
export function boostifyItems(nwr: ReportData['nwrampReport']): ReportLinkItem[] {
  if (!nwr) return []
  const placements: any[] = Array.isArray(nwr.placements) ? nwr.placements : []
  const items: ReportLinkItem[] = placements
    .filter((p) => p.placement !== 'https://newswriter.ai/news' && p.handle !== 'threads' && p.handle !== 'x')
    .map((p) => ({
      // 'https://www.ai-industrynews.com/' -> 'ai-industrynews.com'
      name: String(p.placement || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0],
      link: p.url || null,
      logo: p.logo && p.logo.includes('http')
        ? p.logo
        : `https://cdn1.newsworthy.ai/images/clip_report/newsramp/${(p.placement || '').split('.')[0]}.png`,
    }))
  const xUrl = nwr.x || placements.find((p) => p.handle === 'x')?.url
  const threadsUrl = nwr.threads || placements.find((p) => p.handle === 'threads')?.url
  if (nwr.linkedin) items.push({ name: 'LinkedIn', link: nwr.linkedin, logo: 'https://cdn1.newsworthy.ai/images/clip_report/newsramp/linkedin.png' })
  if (xUrl) items.push({ name: 'X', link: xUrl, logo: 'https://cdn.newsramp.app/nwai-assets/1786373283056-logo-black.png' })
  if (nwr.telegram_posts?.length) items.push({ name: 'Telegram', link: nwr.telegram_posts[0], logo: 'https://cdn1.newsworthy.ai/images/clip_report/newsramp/telegram.png' })
  if (nwr.bluesky) items.push({ name: 'Bluesky', link: nwr.bluesky, logo: 'https://cdn.newsramp.app/bluesky.png' })
  if (nwr.mastodon) items.push({ name: 'Mastodon', link: nwr.mastodon, logo: 'https://cdn.newsramp.app/mastodon.png' })
  if (threadsUrl) items.push({ name: 'Threads', link: threadsUrl, logo: 'https://cdn.newsramp.app/nwai-assets/1786339237413-Threads-app-Logo.png' })
  if (nwr.github) items.push({ name: 'GitHub', link: nwr.github, logo: 'https://cdn.newsramp.app/images/clip_report/newsramp/github.png' })
  if (nwr.substack) items.push({ name: 'Substack', link: nwr.substack, logo: 'https://cdn1.newsworthy.ai/images/clip_report/newsramp/substack.png' })
  return items
}

export function podcastItems(nwr: ReportData['nwrampReport']): { title: string; link: string; artwork: string | null }[] {
  if (!nwr || !Array.isArray(nwr.podcasts)) return []
  return nwr.podcasts.map((p: any) => ({
    title: p.title || 'Podcast',
    link: `https://newsramp.com/podcasts/${p.podcast}`,
    artwork: p.artwork || null,
  }))
}

export function translationItems(nwr: ReportData['nwrampReport']): { language: string; link: string; flag: string }[] {
  if (!nwr || !Array.isArray(nwr.translations)) return []
  const items: { language: string; link: string; flag: string }[] = []
  for (const t of nwr.translations) {
    const entries = Object.entries(t || {})
    if (entries.length === 0) continue
    const [language, link] = entries[0]
    items.push({
      language,
      link: String(link),
      flag: `https://cdn.newsramp.app/images/clip_report/translations/${language.replace(/ /g, '-')}.png`,
    })
  }
  return items
}

const CIRCUIT_THUMBS = 'https://cdn1.newsworthy.ai/images/clipreport/circuits'

export function circuitItems(data: ReportData): CircuitItem[] {
  const { circuits, release } = data
  const items: CircuitItem[] = []
  if (circuits.hr) {
    items.push(
      { circuit: 'HR', name: 'HCM Technology Report', link: `https://www.hcmtechnologyreport.com/${release.slug}`, city: 'Shelton', state: 'CT', thumbnail: `${CIRCUIT_THUMBS}/hcmtechnologyreport.jpg` },
      { circuit: 'HR', name: 'TalentCulture', link: `https://www.talentculture.com/${release.slug}`, city: 'Portland', state: 'OR', thumbnail: `${CIRCUIT_THUMBS}/talentculture.png` },
      { circuit: 'HR', name: 'HR Tech Alliances', link: `https://www.hrtechalliances.com/wordpress/${release.slug}`, city: 'West Chester', state: 'PA', thumbnail: `${CIRCUIT_THUMBS}/hrtechalliances.png` },
      { circuit: 'HR', name: 'HRO Today', link: 'https://www.hrotoday.com/hr-industry-news', city: 'Philadelphia', state: 'PA', thumbnail: `${CIRCUIT_THUMBS}/hrotoday.png` },
      { circuit: 'HR', name: 'HR Marketer', link: 'https://hrmarketer.com', city: 'Aptos', state: 'CA', thumbnail: `${CIRCUIT_THUMBS}/hrmarketer.png` },
      { circuit: 'HR', name: 'HR News on Reddit', link: circuits.data.reddit && circuits.data.reddit.link ? circuits.data.reddit.link : 'https://www.reddit.com/r/HRnews', city: 'San Francisco', state: 'CA', thumbnail: `${CIRCUIT_THUMBS}/reddit.png` },
    )
    if (circuits.data.hrtechfeed) {
      items.push({ circuit: 'HR', name: 'HR Tech Feed', link: circuits.data.hrtechfeed.link || 'https://hrtechfeed.com/press-releases', city: 'Trumbull', state: 'CT', thumbnail: `${CIRCUIT_THUMBS}/hrtechfeed.png` })
    }
  }
  if (circuits.cannabis || circuits.cannadelic || circuits.psychedelics) {
    if (circuits.data.weedweek) {
      items.push({ circuit: 'Cannabis', name: 'WeedWeek', link: `https://www.weedweek.com/${release.slug}`, city: 'Long Beach', state: 'CA', thumbnail: `${CIRCUIT_THUMBS}/weedweek.png` })
    }
    items.push(
      { circuit: 'Cannabis', name: 'AxisWire', link: `https://www.axiswire.com/${release.slug}`, city: 'Santa Monica', state: 'CA', thumbnail: `${CIRCUIT_THUMBS}/axiswire.png` },
      { circuit: 'Cannabis', name: 'Cannabis Radio', link: 'https://www.cannabisradio.com', city: 'Scottsdale', state: 'AZ', thumbnail: `${CIRCUIT_THUMBS}/cannabisradio.png` },
      { circuit: 'Cannabis', name: 'Cannabis News on Reddit', link: circuits.data.reddit && circuits.data.reddit.link ? circuits.data.reddit.link : 'https://www.reddit.com/r/CannabisNewsInfo', city: 'San Francisco', state: 'CA', thumbnail: `${CIRCUIT_THUMBS}/reddit.png` },
    )
  }
  return items
}
