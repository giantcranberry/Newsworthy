import React from 'react'
import { Document, Page, View, Text, Image, Link, StyleSheet, Svg, Path, Circle, Rect, Line as SvgLine } from '@react-pdf/renderer'
import type { ReportData, ClipRecord, TimeBucket, CrawlerGroup } from '@/services/report'
import {
  dailyActivity,
  visibilityGroups,
  hasVisibilityData as reportHasVisibilityData,
  searchPortals,
  boostifyItems,
  podcastItems,
  translationItems,
  circuitItems,
  RESEARCH_DATABASES,
  ENHANCED_DISPLAY_LIMIT,
  ENHANCED_TOTAL_ENDPOINTS,
  type ActivitySeries,
} from '@/lib/clip-report-view'

// --- Colors ---
const C = {
  primary: '#667eea',
  purple: '#764ba2',
  blue: '#3b82f6',
  green: '#22c55e',
  cyan: '#06b6d4',
  pink: '#ec4899',
  amber: '#f59e0b',
  red: '#ef4444',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',
  white: '#ffffff',
  greenLight: '#f0fdf4',
  greenBorder: '#bbf7d0',
  greenText: '#166534',
  amberLight: '#fffbeb',
  amberBorder: '#fde68a',
  amberText: '#92400e',
}

const s = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: C.gray700 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  companyLogo: { maxHeight: 40, maxWidth: 120, objectFit: 'contain' },
  reportTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  reportDate: { fontSize: 8, color: C.gray500, marginTop: 2 },
  hero: { backgroundColor: C.primary, borderRadius: 10, padding: 20, marginBottom: 12, flexDirection: 'row' },
  heroLeft: { width: '25%', alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)', paddingRight: 12 },
  heroEcpc: { fontSize: 36, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 2 },
  heroLabel: { fontSize: 10, color: C.white, marginBottom: 2 },
  heroSub: { fontSize: 7, color: 'rgba(255,255,255,0.8)' },
  heroRight: { width: '75%', paddingLeft: 16, justifyContent: 'center' },
  heroTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 6 },
  heroMeta: { fontSize: 8, color: 'rgba(255,255,255,0.9)', marginBottom: 6 },
  heroAbstract: { fontSize: 8.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 12, alignItems: 'center' },
  metricValue: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 2 },
  metricLabel: { fontSize: 7, color: C.gray500, textTransform: 'uppercase', letterSpacing: 1 },
  metricWide: { flex: 2, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 12, alignItems: 'center' },
  infoBox: { borderLeftWidth: 3, borderLeftColor: C.blue, backgroundColor: C.gray50, borderRadius: 4, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: C.gray200 },
  infoTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.blue, marginBottom: 3 },
  infoText: { fontSize: 8, color: C.gray500, lineHeight: 1.4 },
  sectionCard: { backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 16, marginBottom: 14, borderLeftWidth: 4 },
  sectionTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 4 },
  sectionDesc: { fontSize: 8, color: C.gray500, marginBottom: 10 },
  logoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  logoCard: { width: 80, height: 60, borderRadius: 6, borderWidth: 1, borderColor: C.gray200, alignItems: 'center', justifyContent: 'center', padding: 6, backgroundColor: C.white },
  logoImg: { maxWidth: 68, maxHeight: 48, objectFit: 'contain' },
  logoText: { fontSize: 7, color: C.gray600, textAlign: 'center' },
  clipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  clipCard: { width: '31%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.gray200, borderRadius: 6, padding: 6, gap: 6, marginBottom: 2 },
  clipLogo: { width: 28, height: 28, objectFit: 'contain', borderRadius: 4 },
  clipInitials: { width: 28, height: 28, borderRadius: 4, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' },
  clipInitialsText: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.white },
  clipName: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.gray700 },
  clipLocation: { fontSize: 7, color: C.gray500 },
  circuitCard: { width: 80, borderRadius: 6, borderWidth: 1, borderColor: C.gray200, overflow: 'hidden' },
  circuitImg: { width: 80, height: 45, objectFit: 'contain', backgroundColor: C.gray50 },
  circuitInfo: { padding: 4 },
  circuitName: { fontSize: 7, color: C.blue },
  circuitLoc: { fontSize: 6, color: C.gray500, marginTop: 1 },
  podcastCard: { width: 70, height: 70, borderRadius: 6, borderWidth: 1, borderColor: C.gray200, overflow: 'hidden' },
  podcastImg: { width: 70, height: 70, objectFit: 'contain' },
  perfTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray700, marginBottom: 10 },
  engRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.gray100 },
  engLabel: { fontSize: 8, color: C.gray500 },
  engValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900 },
  advBox: { borderRadius: 8, padding: 12, marginBottom: 14, borderWidth: 1 },
  advTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  advText: { fontSize: 8, lineHeight: 1.4 },
  divider: { height: 1, backgroundColor: C.gray200, marginVertical: 16 },
  tabHeader: { flexDirection: 'row', gap: 12, marginBottom: 10, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: C.gray200 },
  tabLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.primary },
  tabBadge: { fontSize: 7, backgroundColor: C.primary, color: C.white, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
})

/** ['newsworthy.ai', 'newsramp.com'] -> 'newsworthy.ai and newsramp.com' */
function formatSiteList(sites: string[] | undefined) {
  const list = sites && sites.length > 0 ? sites : ['newsworthy.ai']
  if (list.length === 1) return list[0]
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

// --- Image URL validation ---
function isValidPdfImageUrl(url: string | null | undefined): boolean {
  if (!url) return false
  if (url.startsWith('data:image/')) return true
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase()
  return /\.(png|jpe?g|gif|bmp|tiff?)$/.test(cleanUrl)
}

/** Rewrite SVG/WebP image URLs to their PNG equivalents on cdn.newsramp.app */
function toPngUrl(url: string): string {
  if (!url) return url
  if (url === 'https://www.newsworthy.ai/logo.svg') {
    return 'https://cdn.newsramp.app/logos/newsworthy-logo.png'
  }
  if (url.startsWith('https://cdn1.newsworthy.ai/') && /\.(svg|webp)$/i.test(url)) {
    return url
      .replace('https://cdn1.newsworthy.ai/', 'https://cdn.newsramp.app/')
      .replace(/\.(svg|webp)$/i, '.png')
  }
  if (url.startsWith('https://cdn.newsramp.app/') && /\.svg$/i.test(url)) {
    return url.replace(/\.svg$/i, '.png')
  }
  return url
}

// --- Helpers ---
function fmtRelDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtReportDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  })
}

function fmtShortDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

// --- SVG Chart Components ---

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function PieChartSvg({ views, shares }: { views: number; shares: number }) {
  const total = views + shares
  if (total === 0) return null
  const w = 180, h = 150, cx = 90, cy = 65, r = 55
  const viewsAngle = (views / total) * 360

  if (viewsAngle >= 359.9) {
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Circle cx={cx} cy={cy} r={r} fill={C.blue} />
        </Svg>
        <ChartLegend items={[{ color: C.blue, label: 'Views' }, { color: C.green, label: 'Shares' }]} />
      </View>
    )
  }
  if (viewsAngle <= 0.1) {
    return (
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <Circle cx={cx} cy={cy} r={r} fill={C.green} />
        </Svg>
        <ChartLegend items={[{ color: C.blue, label: 'Views' }, { color: C.green, label: 'Shares' }]} />
      </View>
    )
  }

  const p1 = polarToCartesian(cx, cy, r, 0)
  const p2 = polarToCartesian(cx, cy, r, viewsAngle)
  const largeArc1 = viewsAngle > 180 ? 1 : 0
  const largeArc2 = (360 - viewsAngle) > 180 ? 1 : 0
  const viewsPath = `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc1} 1 ${p2.x} ${p2.y} Z`
  const sharesPath = `M ${cx} ${cy} L ${p2.x} ${p2.y} A ${r} ${r} 0 ${largeArc2} 1 ${p1.x} ${p1.y} Z`

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Path d={viewsPath} fill={C.blue} />
        <Path d={sharesPath} fill={C.green} />
      </Svg>
      <ChartLegend items={[{ color: C.blue, label: 'Views' }, { color: C.green, label: 'Shares' }]} />
    </View>
  )
}

function LineChartSvg({ data }: { data: TimeBucket[] }) {
  if (data.length < 2) return null
  const w = 340, h = 180
  const pad = { top: 10, right: 10, bottom: 10, left: 10 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom

  const maxViews = Math.max(...data.map(d => d.views), 1)
  const maxShares = Math.max(...data.map(d => d.shares), 0)
  const showShares = maxShares > 0

  const viewsPoints = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * chartW,
    y: pad.top + chartH - (d.views / maxViews) * chartH,
  }))
  const sharesPoints = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * chartW,
    y: pad.top + chartH - (showShares ? (d.shares / maxShares) * chartH : chartH),
  }))

  const viewsLine = viewsPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const sharesLine = sharesPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const viewsFill = `${viewsLine} L ${viewsPoints[viewsPoints.length - 1].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} L ${viewsPoints[0].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`
  const sharesFill = `${sharesLine} L ${sharesPoints[sharesPoints.length - 1].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} L ${sharesPoints[0].x.toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`

  return (
    <View>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <SvgLine key={pct} x1={pad.left} y1={pad.top + chartH * (1 - pct)} x2={pad.left + chartW} y2={pad.top + chartH * (1 - pct)} stroke={C.gray100} strokeWidth={0.5} />
        ))}
        <Path d={viewsFill} fill={C.blue} fillOpacity={0.15} />
        {showShares && <Path d={sharesFill} fill={C.green} fillOpacity={0.15} />}
        <Path d={viewsLine} fill="none" stroke={C.blue} strokeWidth={1.5} />
        {showShares && <Path d={sharesLine} fill="none" stroke={C.green} strokeWidth={1.5} />}
      </Svg>
      <ChartLegend items={[
        { color: C.blue, label: 'Views' },
        ...(showShares ? [{ color: C.green, label: 'Shares' }] : []),
      ]} />
      {showShares && (
        <Text style={{ fontSize: 6, color: C.gray500, textAlign: 'center', marginTop: 2 }}>
          Shares use their own scale.
        </Text>
      )}
    </View>
  )
}

/**
 * Bars per label, mirroring the web report's Chart.js bar charts. `stacked` stacks
 * every series (Crawler Activity). Otherwise bars are grouped and, as on the page,
 * views get their own scale while the other series share one.
 */
function BarChartSvg({ labels, series, stacked = false }: { labels: string[]; series: ActivitySeries[]; stacked?: boolean }) {
  if (labels.length === 0 || series.length === 0) return null
  const w = 515, h = 150
  const pad = { top: 6, right: 6, bottom: 14, left: 6 }
  const chartW = w - pad.left - pad.right
  const chartH = h - pad.top - pad.bottom
  const slot = chartW / labels.length
  const barGap = Math.min(2, slot * 0.15)

  const viewsOwnScale = !stacked && series[0]?.key === 'views' && series.length > 1
  const maxOf = (list: ActivitySeries[]) => Math.max(1, ...list.flatMap((s) => s.values))
  const stackedMax = Math.max(1, ...labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] || 0), 0)))
  const viewsMax = viewsOwnScale ? maxOf([series[0]]) : 0
  const otherMax = maxOf(viewsOwnScale ? series.slice(1) : series)

  const bars: React.ReactNode[] = []
  labels.forEach((_, i) => {
    const x0 = pad.left + i * slot + barGap / 2
    const slotW = slot - barGap
    if (stacked) {
      let y = pad.top + chartH
      for (const s of series) {
        const bh = ((s.values[i] || 0) / stackedMax) * chartH
        if (bh <= 0) continue
        y -= bh
        bars.push(<Rect key={`${s.key}-${i}`} x={x0} y={y} width={slotW} height={bh} fill={s.color} />)
      }
    } else {
      const bw = slotW / series.length
      series.forEach((s, j) => {
        const max = viewsOwnScale && j === 0 ? viewsMax : otherMax
        const bh = ((s.values[i] || 0) / max) * chartH
        if (bh <= 0) return
        bars.push(<Rect key={`${s.key}-${i}`} x={x0 + j * bw} y={pad.top + chartH - bh} width={bw} height={bh} fill={s.color} />)
      })
    }
  })

  const tickEvery = Math.max(1, Math.ceil(labels.length / 8))
  return (
    <View>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <SvgLine key={pct} x1={pad.left} y1={pad.top + chartH * (1 - pct)} x2={pad.left + chartW} y2={pad.top + chartH * (1 - pct)} stroke={C.gray100} strokeWidth={0.5} />
        ))}
        {bars}
      </Svg>
      <View style={{ flexDirection: 'row', width: w, paddingHorizontal: pad.left }}>
        {labels.map((label, i) => (
          <Text key={i} style={{ width: slot, fontSize: 5.5, color: C.gray500, textAlign: 'center' }}>
            {i % tickEvery === 0 ? label : ''}
          </Text>
        ))}
      </View>
      <ChartLegend items={series.map((s) => ({ color: s.color, label: s.label }))} />
      {viewsOwnScale && (
        <Text style={{ fontSize: 6, color: C.gray500, textAlign: 'center', marginTop: 2 }}>
          Views use their own scale.
        </Text>
      )}
    </View>
  )
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 }}>
      {items.map((item) => (
        <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, backgroundColor: item.color, borderRadius: 2 }} />
          <Text style={{ fontSize: 7, color: C.gray500 }}>{item.label}</Text>
        </View>
      ))}
    </View>
  )
}

const VISIBILITY_CARD_COPY = {
  aiTraining: { title: 'AI Training', subtitle: 'Crawlers building model training data', unit: 'Fetches', color: '#a855f7', emptyText: 'No AI training crawlers have fetched this release yet.' },
  aiGrounding: { title: 'AI Grounding', subtitle: 'Live fetches by AI assistants answering questions', unit: 'Fetches', color: '#f97316', emptyText: 'No AI assistants have retrieved this release to answer a question yet.' },
  seo: { title: 'SEO Crawling & Indexing', subtitle: 'Search engine indexers', unit: 'Crawls', color: C.blue, emptyText: 'No search engine crawlers have visited this release yet.' },
} as const

const PODCAST_BADGES = [
  { name: 'Apple Podcasts', src: 'https://cdn.newsramp.app/badges/apple-badge.png' },
  { name: 'iHeart Radio', src: 'https://cdn.newsramp.app/badges/iheart-badge.png' },
  { name: 'Spotify', src: 'https://cdn.newsramp.app/badges/spotify-badge.png' },
  { name: 'Pandora', src: 'https://cdn.newsramp.app/badges/pandora-badge.png' },
  { name: 'YouTube', src: 'https://cdn.newsramp.app/badges/youtube-badge.png' },
  { name: 'Castbox', src: 'https://cdn.newsramp.app/badges/castbox-badge.png' },
  { name: 'Android', src: 'https://cdn.newsramp.app/badges/android-badge.png' },
  { name: 'PodcastIndex', src: 'https://cdn.newsramp.app/badges/podcast-index-badge.png' },
  { name: 'Deezer', src: 'https://cdn.newsramp.app/badges/deezer.png' },
]

const DAILY_SERIES_PHRASES = {
  views: 'views',
  shares: 'shares',
  aiTraining: 'AI training',
  aiGrounding: 'AI grounding',
  seo: 'SEO',
} as const

function formatSeriesList(items: string[]) {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

// --- Sub-components ---

// imageMap lookup: returns data URL from pre-loaded images (by full URL or filename), or the src if it's a valid remote URL
function resolveImage(src: string, imageMap: Record<string, string>): string | null {
  if (!src) return null
  // Check imageMap by full URL first (pre-fetched remote images)
  if (imageMap[src]) return imageMap[src]
  // Check imageMap by filename (local static images)
  const filename = src.split('/').pop() || ''
  if (imageMap[filename]) return imageMap[filename]
  // Check if it's a valid remote URL (fallback — shouldn't be needed if pre-fetched)
  if (isValidPdfImageUrl(src)) return src
  return null
}

function LogoCardPdf({ src, name, link, imageMap }: { src: string; name: string; link?: string; imageMap: Record<string, string> }) {
  const resolvedSrc = resolveImage(src, imageMap)
  const card = (
    <View style={s.logoCard}>
      {resolvedSrc ? (
        <Image src={resolvedSrc} style={s.logoImg} />
      ) : (
        <Text style={s.logoText}>{name}</Text>
      )}
    </View>
  )
  return link ? <Link src={link}>{card}</Link> : card
}

function ClipCardPdf({ clip, imageMap }: { clip: ClipRecord; imageMap: Record<string, string> }) {
  const resolvedLogo = clip.logo ? resolveImage(clip.logo, imageMap) : null
  return (
    <View style={s.clipCard}>
      {resolvedLogo ? (
        <Image src={resolvedLogo} style={s.clipLogo} />
      ) : (
        <View style={s.clipInitials}>
          <Text style={s.clipInitialsText}>{(clip.name || '??').slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.clipName}>{clip.name}</Text>
        {(clip.city || clip.state) && (
          <Text style={s.clipLocation}>{[clip.city, clip.state].filter(Boolean).join(', ')}</Text>
        )}
      </View>
    </View>
  )
}

function CircuitCardPdf({ thumbnail, name, link, city, state, imageMap }: { thumbnail: string; name: string; link?: string; city: string; state: string; imageMap: Record<string, string> }) {
  const resolvedImg = resolveImage(thumbnail, imageMap)
  const card = (
    <View style={s.circuitCard}>
      {resolvedImg ? (
        <Image src={resolvedImg} style={s.circuitImg} />
      ) : (
        <View style={[s.circuitImg, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 8, color: C.gray600 }}>{name}</Text>
        </View>
      )}
      <View style={s.circuitInfo}>
        <Text style={s.circuitName}>{name}</Text>
        {(city || state) && <Text style={s.circuitLoc}>{[city, state].filter(Boolean).join(', ')}</Text>}
      </View>
    </View>
  )
  return link ? <Link src={link}>{card}</Link> : card
}

function SectionCardPdf({ borderColor, children }: { borderColor: string; children: React.ReactNode }) {
  return <View style={[s.sectionCard, { borderLeftColor: borderColor }]}>{children}</View>
}

function VisibilityCardPdf({ title, subtitle, unit, color, group, emptyText }: {
  title: string
  subtitle: string
  unit: string
  color: string
  group: CrawlerGroup
  emptyText: string
}) {
  const topBots = group.bots.slice(0, 6)
  const otherBots = group.bots.slice(6)
  const otherHits = otherBots.reduce((sum, b) => sum + b.hits, 0)
  return (
    <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, borderLeftWidth: 3, borderLeftColor: color, padding: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <View style={{ flex: 1, paddingRight: 6 }}>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.gray800 }}>{title}</Text>
          <Text style={{ fontSize: 6.5, color: C.gray500, marginTop: 1 }}>{subtitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.gray900 }}>{group.total.toLocaleString()}</Text>
          <Text style={{ fontSize: 6, color: C.gray500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{unit}</Text>
        </View>
      </View>
      {group.total === 0 ? (
        <Text style={{ fontSize: 7, color: C.gray500 }}>{emptyText}</Text>
      ) : (
        <View>
          {topBots.map((b) => (
            <View key={b.botName} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: C.gray100 }}>
              <Text style={{ fontSize: 7.5, color: C.gray700 }}>{b.botName}</Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: color }}>{b.hits.toLocaleString()}</Text>
            </View>
          ))}
          {otherBots.length > 0 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
              <Text style={{ fontSize: 7.5, color: C.gray500 }}>{otherBots.length} other {otherBots.length === 1 ? 'bot' : 'bots'}</Text>
              <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.gray500 }}>{otherHits.toLocaleString()}</Text>
            </View>
          )}
          {(group.firstSeen || group.lastSeen) && (
            <Text style={{ fontSize: 6.5, color: C.gray500, marginTop: 4 }}>
              {group.firstSeen ? `First visit ${fmtShortDate(group.firstSeen)}` : ''}
              {group.firstSeen && group.lastSeen ? '  ·  ' : ''}
              {group.lastSeen ? `Most recent ${fmtShortDate(group.lastSeen)}` : ''}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

// --- Main PDF Document ---
export function ReportPdfDocument({ data, imageMap = {} }: { data: ReportData; imageMap?: Record<string, string> }) {
  const { release, company, clips, totalPv, totalSh, ecpc, hasAdvGroup, nwrampReport, enhancedPublications, yahooFinanceUrls, circuits, encodedTitle, pdfDownloadCount } = data
  const marketClips = [...clips.fcmarkets, ...clips.marketminute]
  const hasDistNetwork = clips.gomedia.length > 0 || clips.synacor.length > 0 || marketClips.length > 0
  const hasCircuits = circuits.hr || circuits.cannabis || circuits.cannadelic || circuits.psychedelics
  const reportDate = fmtReportDate(data.fetchedAt)
  const hasStats = data.combStats.length > 0
  const crawlerStats = data.crawlerStats
  const citations = data.aiGrounding?.citations ?? []
  const hasVisibilityData = !!crawlerStats && reportHasVisibilityData(data)
  const shownVisibility = visibilityGroups(data)
  const daily = dailyActivity(data)
  const circuitList = circuitItems(data)
  const podcasts = podcastItems(nwrampReport)
  const translations = translationItems(nwrampReport)

  const rawCompanyLogo = company.logoUrl
    ? company.logoUrl.includes('cdn.filestac')
      ? company.logoUrl.replace(/RESIZE/i, 'resize=width:300/output=format:png')
      : company.logoUrl
    : null
  const companyLogoSrc = rawCompanyLogo ? resolveImage(rawCompanyLogo, imageMap) : null
  const validCompanyLogo = !!companyLogoSrc

  const newsUrl = (() => {
    if (!release.releaseAt) return ''
    const d = new Date(release.releaseAt)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
  })()

  return (
    <Document>
      {/* Page 1: Header, Hero, Metrics, Analytics */}
      <Page size="A4" style={s.page} wrap>
        {/* Header */}
        <View wrap={false} style={s.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {validCompanyLogo && <Image src={companyLogoSrc!} style={s.companyLogo} />}
            <View>
              <Text style={s.reportTitle}>Clipping Report</Text>
              <Text style={s.reportDate}>As of {reportDate}</Text>
            </View>
          </View>
        </View>

        {/* Hero */}
        <View wrap={false} style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={s.heroEcpc}>${ecpc}</Text>
            <Text style={s.heroLabel}>Effective CPC</Text>
            <Text style={s.heroSub}>Based on standard distribution</Text>
          </View>
          <View style={s.heroRight}>
            {newsUrl ? (
              <Link src={newsUrl}><Text style={s.heroTitle}>{release.title}</Text></Link>
            ) : (
              <Text style={s.heroTitle}>{release.title}</Text>
            )}
            <Text style={s.heroMeta}>
              {release.location ? `${release.location.toUpperCase()}  •  ` : ''}{fmtRelDate(release.releasedAt)}
            </Text>
            {release.abstract && <Text style={s.heroAbstract}>{release.abstract}</Text>}
          </View>
        </View>

        {/* Key Metrics */}
        <View wrap={false} style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={[s.metricValue, { color: C.blue }]}>{totalPv.toLocaleString()}</Text>
            <Text style={s.metricLabel}>Total Views</Text>
          </View>
          {totalSh > 0 && (
            <View style={s.metricCard}>
              <Text style={[s.metricValue, { color: C.green }]}>{totalSh.toLocaleString()}</Text>
              <Text style={s.metricLabel}>Total Shares</Text>
            </View>
          )}
          <View style={s.metricWide}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              {resolveImage('https://cdn.newsramp.app/logos/openai.png', imageMap) && <Image src={resolveImage('https://cdn.newsramp.app/logos/openai.png', imageMap)!} style={{ width: 22, height: 22, objectFit: 'contain' }} />}
              {resolveImage('https://cdn.newsramp.app/logos/gemini.png', imageMap) && <Image src={resolveImage('https://cdn.newsramp.app/logos/gemini.png', imageMap)!} style={{ width: 22, height: 22, objectFit: 'contain' }} />}
              {resolveImage('https://cdn.newsramp.app/logos/google.png', imageMap) && <Image src={resolveImage('https://cdn.newsramp.app/logos/google.png', imageMap)!} style={{ width: 22, height: 22, objectFit: 'contain' }} />}
            </View>
            {hasVisibilityData ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 2 }}>
                  {shownVisibility.map((g) => (
                    <View key={g.key} style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray900 }}>{g.group.total.toLocaleString()}</Text>
                      <Text style={s.metricLabel}>{g.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ fontSize: 6.5, color: C.gray500, marginTop: 4, textAlign: 'center' }}>
                  {citations.length > 0
                    ? `Cited by ${(data.aiGrounding?.sources ?? []).map((src) => citations.find((c) => c.source === src)?.sourceLabel || src).join(', ')}.`
                    : `${formatSeriesList(shownVisibility.map((g) => g.label))} activity is detailed below.`}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 2 }}>AIO / SEO?</Text>
                <Text style={{ fontSize: 7, color: C.gray500, textTransform: 'uppercase' }}>We&apos;ve got you covered.</Text>
                <Text style={{ fontSize: 7, color: C.gray500, marginTop: 2 }}>Your Press Release is optimized for AI and Search.</Text>
              </>
            )}
          </View>
        </View>

        {/* 1.182 Billion */}
        <View wrap={false} style={s.infoBox}>
          <Text style={s.infoTitle}>1.182 Billion</Text>
          <Text style={s.infoText}>With our Newsramp distribution we now reach an audience of more than 1.182 billion in their native language.</Text>
        </View>

        {/* Performance Analytics */}
        {hasStats && (
          <View wrap={false}>
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray700, marginBottom: 10 }}>Performance Analytics</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {/* Engagement Summary + Pie */}
              <View style={{ flex: 1, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 12 }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.gray800, marginBottom: 8 }}>Engagement Summary</Text>
                <View style={s.engRow}>
                  <Text style={s.engLabel}>Total Views</Text>
                  <Text style={s.engValue}>{totalPv.toLocaleString()}</Text>
                </View>
                {totalSh > 0 && (
                  <View style={s.engRow}>
                    <Text style={s.engLabel}>Total Shares</Text>
                    <Text style={s.engValue}>{totalSh.toLocaleString()}</Text>
                  </View>
                )}
                {pdfDownloadCount > 0 && (
                  <View style={s.engRow}>
                    <Text style={s.engLabel}>PDF Downloads</Text>
                    <Text style={[s.engValue, { color: C.red }]}>{pdfDownloadCount.toLocaleString()}</Text>
                  </View>
                )}
                <View style={[s.engRow, { borderBottomWidth: 0 }]}>
                  <Text style={s.engLabel}>Total Engagement</Text>
                  <Text style={s.engValue}>{(totalPv + totalSh).toLocaleString()}</Text>
                </View>
                {(totalPv > 0 || totalSh > 0) && (
                  <PieChartSvg views={totalPv} shares={totalSh} />
                )}
              </View>
              {/* Cumulative Growth */}
              {data.constGrowthStats.length >= 2 && data.constGrowthStats.some((b) => b.views > 0 || b.shares > 0) && (
                <View style={{ flex: 2, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 12 }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.gray800, marginBottom: 4 }}>Cumulative Growth</Text>
                  <Text style={{ fontSize: 7, color: C.gray500, marginBottom: 8 }}>Track your content&apos;s momentum over time</Text>
                  <LineChartSvg data={data.constGrowthStats} />
                </View>
              )}
            </View>
          </View>
        )}

        {daily.series.length > 0 && (
          <View wrap={false} style={{ backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.gray800, marginBottom: 2 }}>Daily Activity</Text>
            <Text style={{ fontSize: 7, color: C.gray500, marginBottom: 8 }}>
              Day-by-day breakdown of {formatSeriesList(daily.series.map((ser) => DAILY_SERIES_PHRASES[ser.key]))} (UTC)
            </Text>
            <BarChartSvg labels={daily.labels} series={daily.series} />
          </View>
        )}

        {nwrampReport?.linkedin_analytics && (
          <View wrap={false} style={{ backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, borderLeftWidth: 4, borderLeftColor: '#0A66C2', padding: 12, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray800, marginBottom: 2 }}>
              LinkedIn Performance
            </Text>
            <Text style={{ fontSize: 7, color: C.gray500, marginBottom: 8 }}>
              Organic engagement · Week {nwrampReport.linkedin_analytics.week_number}
            </Text>
            <View style={s.metricsRow}>
              {[
                ['Impressions', nwrampReport.linkedin_analytics.impressions],
                ['Likes', nwrampReport.linkedin_analytics.likes],
                ['Comments', nwrampReport.linkedin_analytics.comments],
                ['Shares', nwrampReport.linkedin_analytics.shares],
                ['Clicks', nwrampReport.linkedin_analytics.clicks],
              ]
                .filter(([, value]) => Number(value || 0) > 0)
                .map(([label, value]) => (
                <View key={String(label)} style={s.metricCard}>
                  <Text style={[s.metricValue, { fontSize: 14 }]}>{Number(value || 0).toLocaleString()}</Text>
                  <Text style={s.metricLabel}>{String(label)}</Text>
                </View>
              ))}
            </View>
            {Array.isArray(nwrampReport.linkedin_analytics.comment_texts) &&
              nwrampReport.linkedin_analytics.comment_texts.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={[s.sectionDesc, { marginBottom: 4 }]}>Recent comments</Text>
                  {nwrampReport.linkedin_analytics.comment_texts.slice(0, 5).map((c: any, i: number) => (
                    <Text key={c?.urn || i} style={{ fontSize: 8, color: C.gray700, marginBottom: 3 }}>
                      • {c?.text || '(no text)'}
                    </Text>
                  ))}
                </View>
              )}
          </View>
        )}

        {/* AI & Search Visibility */}
        {hasVisibilityData && crawlerStats && (
          <View style={{ marginBottom: 12 }}>
            <View wrap={false}>
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.gray700, marginBottom: 2 }}>AI &amp; Search Visibility</Text>
              <Text style={{ fontSize: 8, color: C.gray700, marginBottom: 4 }}>
                As measured on Newsworthy.ai site and Newsramp network, Not across the entire distribution network or the enhanced networks.
              </Text>
              <Text style={{ fontSize: 7.5, color: C.gray500, marginBottom: 8 }}>
                Verified bot traffic to your press release on {formatSiteList(crawlerStats.sites)}, broken out by what each crawler is doing with your content.
              </Text>
            </View>
            <View wrap={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {shownVisibility.map((g) => (
                <VisibilityCardPdf
                  key={g.key}
                  {...VISIBILITY_CARD_COPY[g.key]}
                  group={g.group}
                />
              ))}
            </View>

            {crawlerStats.daily.length > 1 && shownVisibility.length > 0 && (
              <View wrap={false} style={{ backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, padding: 10, marginBottom: 8 }}>
                <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.gray800 }}>Crawler Activity</Text>
                <Text style={{ fontSize: 6.5, color: C.gray500, marginBottom: 6 }}>
                  Daily bot fetches by purpose{(crawlerStats.sites?.length ?? 0) > 1 ? ' on newsworthy.ai' : ''} (UTC)
                </Text>
                <BarChartSvg
                  stacked
                  labels={crawlerStats.daily.map((d) => { const [, m, day] = d.date.split('-'); return m && day ? `${m}/${day}` : d.date })}
                  series={shownVisibility.map((g) => ({
                    key: g.key,
                    label: g.key === 'seo' ? 'SEO' : g.label,
                    color: VISIBILITY_CARD_COPY[g.key].color,
                    values: crawlerStats.daily.map((d) => d[g.key]),
                  }))}
                />
              </View>
            )}

            {citations.length > 0 && (
              <View style={{ backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.gray200, borderLeftWidth: 3, borderLeftColor: '#f97316', padding: 10 }}>
                <View wrap={false}>
                  <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: C.gray800 }}>AI Search Citations</Text>
                  <Text style={{ fontSize: 6.5, color: C.gray500, marginBottom: 6 }}>
                    Queries where an AI search product cited your release or its syndicated copies as a source.
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: C.gray200, marginBottom: 2 }}>
                  <Text style={{ width: '24%', fontSize: 6.5, color: C.gray500, textTransform: 'uppercase' }}>Source</Text>
                  <Text style={{ width: '58%', fontSize: 6.5, color: C.gray500, textTransform: 'uppercase' }}>Query</Text>
                  <Text style={{ width: '18%', fontSize: 6.5, color: C.gray500, textTransform: 'uppercase', textAlign: 'right' }}>Verified</Text>
                </View>
                {citations.slice(0, 25).map((c, i) => (
                  <View key={`${c.source}-${i}`} wrap={false} style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.gray100 }}>
                    <Text style={{ width: '24%', fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#c2410c', paddingRight: 4 }}>{c.sourceLabel}</Text>
                    <Text style={{ width: '58%', fontSize: 7.5, color: C.gray700, paddingRight: 4 }}>{c.query}</Text>
                    <Text style={{ width: '18%', fontSize: 7, color: C.gray500, textAlign: 'right' }}>{fmtShortDate(c.createdAt)}</Text>
                  </View>
                ))}
                {citations.length > 25 && (
                  <Text style={{ fontSize: 6.5, color: C.gray500, marginTop: 4 }}>Showing 25 of {citations.length} citations. The full list is in the XLS export.</Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Share List Alert */}
        {hasAdvGroup ? (
          <View wrap={false} style={[s.advBox, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
            <Text style={[s.advTitle, { color: C.greenText }]}>Share List Active</Text>
            <Text style={[s.advText, { color: '#15803d' }]}>Your share list is helping amplify your message.</Text>
          </View>
        ) : (
          <View wrap={false} style={[s.advBox, { backgroundColor: C.amberLight, borderColor: C.amberBorder }]}>
            <Text style={[s.advTitle, { color: C.amberText }]}>Boost Your Reach with Share Lists</Text>
            <Text style={[s.advText, { color: '#b45309' }]}>Set up a share list to amplify your message through your network.</Text>
          </View>
        )}

        <View style={s.divider} />

        {/* Blockchain */}
        {nwrampReport && nwrampReport.blockchain_qrcode && isValidPdfImageUrl(nwrampReport.blockchain_qrcode) && (
          <SectionCardPdf borderColor={C.purple}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Blockchain Verification</Text>
              <Text style={s.sectionDesc}>Immutable proof of publication secured on the blockchain</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Image src={resolveImage(nwrampReport.blockchain_qrcode, imageMap) || nwrampReport.blockchain_qrcode} style={{ width: 120, height: 120 }} />
            </View>
          </SectionCardPdf>
        )}

        {/* Search & News Portals */}
        <SectionCardPdf borderColor={C.primary}>
          <View wrap={false}>
            <Text style={s.sectionTitle}>Search &amp; News Portals</Text>
            <Text style={s.sectionDesc}>Your press release is discoverable across major search engines and news aggregators</Text>
          </View>
          <View style={s.logoGrid}>
            {searchPortals(data).map((item, i) => (
              <LogoCardPdf key={`portal-${i}`} src={item.logo} name={item.name} link={item.link || undefined} imageMap={imageMap} />
            ))}
          </View>
        </SectionCardPdf>

        {/* Subscription Research Databases */}
        <SectionCardPdf borderColor={C.cyan}>
          <View wrap={false}>
            <Text style={s.sectionTitle}>Subscription Research Databases</Text>
            <Text style={s.sectionDesc}>Your content is indexed in premium research and analytics platforms</Text>
          </View>
          <View style={s.logoGrid}>
            {RESEARCH_DATABASES.map((item) => (
              <LogoCardPdf key={item.name} src={item.logo} name={item.name} link={item.link || undefined} imageMap={imageMap} />
            ))}
          </View>
        </SectionCardPdf>

        {/* Circuits */}
        {circuitList.length > 0 && (
          <SectionCardPdf borderColor={C.pink}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Specialized Circuits</Text>
              <Text style={s.sectionDesc}>Targeted distribution to industry-specific platforms and communities</Text>
            </View>

            {(['HR', 'Cannabis'] as const).map((circuit) => {
              const items = circuitList.filter((item) => item.circuit === circuit)
              if (items.length === 0) return null
              return (
                <View key={circuit} style={[s.logoGrid, { marginBottom: 10 }]}>
                  {items.map((item) => (
                    <CircuitCardPdf key={item.name} thumbnail={item.thumbnail} name={item.name} link={item.link} city={item.city} state={item.state} imageMap={imageMap} />
                  ))}
                </View>
              )
            })}
          </SectionCardPdf>
        )}
      </Page>

      {/* Enhanced Distribution - own page */}
      {enhancedPublications.length > 0 && (
        <Page size="A4" style={s.page} wrap>
          <SectionCardPdf borderColor={C.primary}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Enhanced Distribution</Text>
              <Text style={s.sectionDesc}>Representative distribution sample. Showing {Math.min(ENHANCED_DISPLAY_LIMIT, enhancedPublications.length)} of {ENHANCED_TOTAL_ENDPOINTS} endpoints. Some of the endpoints below require publication subscriptions that prevent linking directly to your press release. If you would like a full listing please contact us.</Text>
            </View>
            <View style={s.logoGrid}>
              {enhancedPublications.slice(0, ENHANCED_DISPLAY_LIMIT).map((pub, i) => (
                <LogoCardPdf key={i} src={toPngUrl(pub.logo_url)} name={pub.name} link={pub.link || undefined} imageMap={imageMap} />
              ))}
            </View>
          </SectionCardPdf>
        </Page>
      )}

      {/* Newsramp Boostify - own page */}
      {nwrampReport && (
        <Page size="A4" style={s.page} wrap>
          <SectionCardPdf borderColor={C.green}>
            <View wrap={false}>
              <Text style={s.sectionTitle}>Newsramp Boostify{'\u2122'} Circuit</Text>
              <Text style={s.sectionDesc}>Extended distribution network amplifying your message across specialized platforms</Text>
            </View>
            <View style={s.logoGrid}>
              {boostifyItems(nwrampReport).map((item, i) => (
                <LogoCardPdf key={`boost-${i}`} src={toPngUrl(item.logo)} name={item.name} link={item.link || undefined} imageMap={imageMap} />
              ))}
            </View>

            {podcasts.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 6 }}>Podcasts</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {podcasts.map((pod, i) => {
                    const artSrc = pod.artwork ? resolveImage(pod.artwork, imageMap) : null
                    if (!artSrc) return null
                    return (
                      <Link key={i} src={pod.link}>
                        <View style={s.podcastCard}>
                          <Image src={artSrc} style={s.podcastImg} />
                        </View>
                      </Link>
                    )
                  })}
                </View>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 6 }}>Listen On:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {PODCAST_BADGES.map((badge) => {
                    const badgeSrc = resolveImage(badge.src, imageMap)
                    if (!badgeSrc) return null
                    return <Image key={badge.name} src={badgeSrc} style={{ width: 80, height: 24, objectFit: 'contain' }} />
                  })}
                </View>
              </View>
            )}

            {translations.length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.gray900, marginBottom: 6 }}>Language Translations</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {translations.map((t, i) => {
                    const flagSrc = resolveImage(t.flag, imageMap)
                    return (
                      <Link key={i} src={t.link}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {flagSrc && <Image src={flagSrc} style={{ width: 18, height: 18, objectFit: 'contain' }} />}
                          <Text style={{ fontSize: 9, color: C.blue }}>{t.language}</Text>
                        </View>
                      </Link>
                    )
                  })}
                </View>
              </View>
            )}
          </SectionCardPdf>
        </Page>
      )}

      {/* Distribution Network - own page */}
      {hasDistNetwork && (
        <Page size="A4" style={s.page} wrap>
          <View wrap={false}>
            <Text style={s.sectionTitle}>Distribution Network</Text>
            <Text style={s.sectionDesc}>Representative sampling of your distribution network. Your release reaches hundreds of additional endpoints through our syndication partners.</Text>
          </View>

          {clips.gomedia.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View wrap={false} style={s.tabHeader}>
                <Text style={s.tabLabel}>Online Sources</Text>
                <Text style={s.tabBadge}>{clips.gomedia.length}</Text>
              </View>
              <View style={s.clipGrid}>
                {clips.gomedia.map((c) => <ClipCardPdf key={c.id} clip={c} imageMap={imageMap} />)}
              </View>
            </View>
          )}

          {clips.synacor.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View wrap={false} style={s.tabHeader}>
                <Text style={s.tabLabel}>ISP Portals</Text>
                <Text style={s.tabBadge}>{clips.synacor.length}</Text>
              </View>
              <View style={s.clipGrid}>
                {clips.synacor.map((c) => <ClipCardPdf key={c.id} clip={c} imageMap={imageMap} />)}
              </View>
            </View>
          )}

          {marketClips.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <View wrap={false} style={s.tabHeader}>
                <Text style={s.tabLabel}>Market Sources</Text>
                <Text style={s.tabBadge}>{marketClips.length}</Text>
              </View>
              <View style={s.clipGrid}>
                {marketClips.map((c) => <ClipCardPdf key={c.id} clip={c} imageMap={imageMap} />)}
              </View>
            </View>
          )}
        </Page>
      )}
    </Document>
  )
}
