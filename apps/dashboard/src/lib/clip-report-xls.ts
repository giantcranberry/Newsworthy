import type { ReportData, ClipRecord } from '@/services/report'
import {
  dailyActivity,
  visibilityGroups,
  hasVisibilityData,
  searchPortals,
  boostifyItems,
  podcastItems,
  translationItems,
  circuitItems,
  RESEARCH_DATABASES,
  ENHANCED_DISPLAY_LIMIT,
  ENHANCED_TOTAL_ENDPOINTS,
} from '@/lib/clip-report-view'
import * as XLSX from 'xlsx'

// Sheets follow the web clipping report section by section, using the same
// helpers (lib/clip-report-view) so the export lists exactly what the page shows.

type Row = (string | number)[]

function sheet(rows: Row[], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
}

function fmtIsoDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
}

function buildSummarySheet(data: ReportData) {
  const rows: Row[] = [
    ['Clipping Report'],
    [],
    ['Company', data.company.companyName],
    ['Release Title', data.release.title || ''],
    ['Release Date', data.release.releasedAt ? new Date(data.release.releasedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''],
    ['Location', data.release.location || ''],
    [],
    ['Metrics'],
    ['As Of', fmtIsoDateTime(data.fetchedAt)],
    ['Effective CPC', `$${data.ecpc}`],
    ['Total Views', data.totalPv],
  ]
  if (data.totalSh > 0) rows.push(['Total Shares', data.totalSh])
  if (data.pdfDownloadCount > 0) rows.push(['PDF Downloads', data.pdfDownloadCount])
  rows.push(['Total Engagement', data.totalPv + data.totalSh])
  rows.push(['Share List', data.hasAdvGroup ? 'Active' : 'Not set up'])

  if (hasVisibilityData(data)) {
    rows.push([], ['AI & Search Visibility'])
    for (const g of visibilityGroups(data)) rows.push([g.label, g.group.total])
    const citations = data.aiGrounding?.citations.length ?? 0
    if (citations > 0) rows.push(['AI Search Citations', citations])
  }

  return sheet(rows, [22, 60])
}

function buildDailyActivitySheet(daily: ReturnType<typeof dailyActivity>) {
  const rows: Row[] = [['Date', ...daily.series.map((s) => s.label)]]
  daily.labels.forEach((label, i) => {
    rows.push([label, ...daily.series.map((s) => s.values[i] ?? 0)])
  })
  return sheet(rows, [22, ...daily.series.map(() => 14)])
}

function buildGrowthSheet(data: ReportData) {
  const showShares = data.constGrowthStats.some((b) => b.shares > 0)
  const rows: Row[] = [['Date', 'Cumulative Views', ...(showShares ? ['Cumulative Shares'] : [])]]
  for (const b of data.constGrowthStats) {
    rows.push([b.key_as_string, b.views, ...(showShares ? [b.shares] : [])])
  }
  return sheet(rows, [22, 18, 18])
}

function buildLinkedInAnalyticsSheet(data: ReportData) {
  const li = data.nwrampReport?.linkedin_analytics
  const rows: Row[] = [
    ['Metric', 'Value'],
    ['Week', li?.week_number ?? ''],
    ['Post URN', li?.post_urn || ''],
    ['Fetched At', li?.fetched_at || ''],
    ['Impressions', li?.impressions ?? 0],
    ['Unique Impressions', li?.unique_impressions ?? 0],
    ['Likes', li?.likes ?? 0],
    ['Comments', li?.comments ?? 0],
    ['Shares', li?.shares ?? 0],
    ['Clicks', li?.clicks ?? 0],
    ['Engagement', li?.engagement ?? 0],
  ]

  const reactions = li?.reactions || {}
  for (const [type, count] of Object.entries(reactions)) {
    rows.push([`Reaction: ${type}`, Number(count || 0)])
  }

  rows.push(['', ''])
  rows.push(['Comment Text', 'Actor'])
  for (const c of li?.comment_texts || []) {
    rows.push([c?.text || '', c?.actor || ''])
  }

  if (Array.isArray(li?.weeks) && li.weeks.length > 1) {
    rows.push(['', ''])
    rows.push(['Week History', 'Impressions', 'Likes', 'Comments', 'Shares', 'Clicks'])
    for (const w of li.weeks) {
      rows.push([w.week_number, w.impressions ?? 0, w.likes ?? 0, w.comments ?? 0, w.shares ?? 0, w.clicks ?? 0])
    }
  }

  return sheet(rows, [24, 60, 12, 12, 12, 12])
}

function buildCrawlerSheet(data: ReportData) {
  const stats = data.crawlerStats!
  const rows: Row[] = [['Category', 'Bot', 'Fetches', 'First Visit', 'Most Recent Visit']]
  for (const g of visibilityGroups(data)) {
    const label = g.key === 'seo' ? 'SEO Crawling & Indexing' : g.label
    for (const b of g.group.bots) {
      rows.push([label, b.botName, b.hits, fmtIsoDateTime(b.firstSeen), fmtIsoDateTime(b.lastSeen)])
    }
  }

  // Matches the page's Crawler Activity chart (shown when there is more than one day)
  if (stats.daily.length > 1) {
    rows.push([], ['Crawler Activity (UTC)'], ['Date', 'AI Training', 'AI Grounding', 'SEO'])
    for (const d of stats.daily) {
      rows.push([d.date, d.aiTraining, d.aiGrounding, d.seo])
    }
  }

  if (stats.sites && stats.sites.length > 0) {
    rows.push([], ['Measured On', stats.sites.join(', ')])
  }

  return sheet(rows, [24, 26, 12, 24, 24])
}

function buildCitationsSheet(grounding: NonNullable<ReportData['aiGrounding']>) {
  const rows: Row[] = [['Source', 'Query', 'Verified']]
  for (const c of grounding.citations) {
    rows.push([c.sourceLabel, c.query, fmtIsoDateTime(c.createdAt)])
  }
  return sheet(rows, [22, 80, 24])
}

function buildPortalsSheet(data: ReportData) {
  const rows: Row[] = [['Search & News Portals', 'Link']]
  for (const p of searchPortals(data)) rows.push([p.name, p.link || ''])
  rows.push([], ['Subscription Research Databases', 'Link'])
  for (const p of RESEARCH_DATABASES) rows.push([p.name, p.link || ''])
  return sheet(rows, [32, 80])
}

function buildEnhancedSheet(data: ReportData) {
  const shown = data.enhancedPublications.slice(0, ENHANCED_DISPLAY_LIMIT)
  const rows: Row[] = [
    [`Representative distribution sample: ${shown.length} of ${ENHANCED_TOTAL_ENDPOINTS} endpoints`],
    [],
    ['Publication', 'Link'],
    ...shown.map((p) => [p.name, p.link]),
  ]
  return sheet(rows, [35, 60])
}

function buildBoostifySheet(data: ReportData) {
  const nwr = data.nwrampReport
  const rows: Row[] = [['Platform', 'Link']]
  for (const item of boostifyItems(nwr)) rows.push([item.name, item.link || ''])

  const podcasts = podcastItems(nwr)
  if (podcasts.length > 0) {
    rows.push([], ['Podcast', 'Link'])
    for (const p of podcasts) rows.push([p.title, p.link])
  }

  const translations = translationItems(nwr)
  if (translations.length > 0) {
    rows.push([], ['Language Translation', 'Link'])
    for (const t of translations) rows.push([t.language, t.link])
  }

  if (nwr?.blockchain_qrcode) {
    rows.push([], ['Blockchain Verification QR Code', nwr.blockchain_qrcode])
  }

  return sheet(rows, [32, 80])
}

function buildCircuitsSheet(data: ReportData) {
  const rows: Row[] = [['Circuit', 'Outlet', 'City', 'State', 'Link']]
  for (const c of circuitItems(data)) rows.push([c.circuit, c.name, c.city, c.state, c.link])
  return sheet(rows, [12, 30, 16, 8, 70])
}

function buildClipsSheet(data: ReportData) {
  const rows: Row[] = [['Name', 'Category', 'City', 'State', 'Link']]
  const add = (clips: ClipRecord[], category: string) => {
    for (const c of clips) rows.push([c.name || '', category, c.city || '', c.state || '', c.link || ''])
  }
  add(data.clips.gomedia, 'Online Sources')
  add(data.clips.synacor, 'ISP Portals')
  add([...data.clips.fcmarkets, ...data.clips.marketminute], 'Market Sources')
  return sheet(rows, [35, 18, 18, 8, 60])
}

/** The clipping report as an XLSX workbook: one sheet per report section */
export function buildClipReportWorkbook(data: ReportData) {
  const wb = XLSX.utils.book_new()
  const add = (ws: XLSX.WorkSheet, name: string) => XLSX.utils.book_append_sheet(wb, ws, name)

  add(buildSummarySheet(data), 'Summary')

  const daily = dailyActivity(data)
  if (daily.series.length > 0) add(buildDailyActivitySheet(daily), 'Daily Activity')
  if (data.combStats.length > 0 && data.constGrowthStats.some((b) => b.views > 0 || b.shares > 0)) {
    add(buildGrowthSheet(data), 'Cumulative Growth')
  }
  if (data.nwrampReport?.linkedin_analytics) add(buildLinkedInAnalyticsSheet(data), 'LinkedIn Analytics')

  if (visibilityGroups(data).length > 0) add(buildCrawlerSheet(data), 'AI & SEO Crawlers')
  if (data.aiGrounding && data.aiGrounding.citations.length > 0) add(buildCitationsSheet(data.aiGrounding), 'AI Search Citations')

  add(buildPortalsSheet(data), 'Search & Research')
  if (data.enhancedPublications.length > 0) add(buildEnhancedSheet(data), 'Enhanced Distribution')
  if (data.nwrampReport) add(buildBoostifySheet(data), 'Newsramp Boostify')
  if (circuitItems(data).length > 0) add(buildCircuitsSheet(data), 'Specialized Circuits')

  const { gomedia, synacor, fcmarkets, marketminute } = data.clips
  if (gomedia.length + synacor.length + fcmarkets.length + marketminute.length > 0) {
    add(buildClipsSheet(data), 'Distribution Network')
  }
  return wb
}
