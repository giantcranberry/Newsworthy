import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getReportData, type ReportData } from '@/services/report'
import { renderToBuffer } from '@react-pdf/renderer'
import { ReportPdfDocument } from './report-pdf'
import React from 'react'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'

// Pre-load local static images from public/img/clip_report as base64 data URLs
// so react-pdf doesn't need to HTTP-fetch from localhost
function buildStaticImageMap(): Record<string, string> {
  const baseDir = join(process.cwd(), 'public', 'img', 'clip_report')
  const map: Record<string, string> = {}

  const files = [
    'google.png', 'microsoft.jpg', 'citybuzz.png', 'streetinsider.png',
    'linkedin.png', 'reddit.png', 'substack.png', 'newsramp.png',
    'advos.png', 'hcmtechnologyreport.jpg', 'talentculture.png',
    'hrtechalliances.png', 'hrotoday.png', 'hrtechfeed.png',
    'axiswire.png', 'cannabisradio.png', 'weedweek.png',
  ]

  for (const file of files) {
    const fullPath = join(baseDir, file)
    if (existsSync(fullPath)) {
      const buf = readFileSync(fullPath)
      const ext = extname(file).toLowerCase().replace('.', '')
      const mime = ext === 'jpg' ? 'jpeg' : ext
      map[file] = `data:image/${mime};base64,${buf.toString('base64')}`
    }
  }

  return map
}

let cachedImageMap: Record<string, string> | null = null
function getStaticImageMap(): Record<string, string> {
  if (!cachedImageMap) cachedImageMap = buildStaticImageMap()
  return cachedImageMap
}

/** Rewrite SVG/WebP URLs to PNG equivalents (same logic as report-pdf.tsx toPngUrl) */
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

function isValidImageUrl(url: string): boolean {
  if (!url || !url.startsWith('http')) return false
  const clean = url.split('?')[0].split('#')[0].toLowerCase()
  return /\.(png|jpe?g|gif|bmp|tiff?)$/.test(clean)
}

/**
 * Collect all remote image URLs referenced in the report data,
 * fetch them in parallel, and return a map of URL → base64 data URI.
 * This prevents react-pdf from making dozens of HTTP fetches during rendering.
 */
async function prefetchRemoteImages(data: ReportData, staticMap: Record<string, string>): Promise<Record<string, string>> {
  const urls = new Set<string>()

  // AI logos
  urls.add('https://cdn.newsramp.app/logos/openai.png')
  urls.add('https://cdn.newsramp.app/logos/gemini.png')
  urls.add('https://cdn.newsramp.app/logos/google.png')

  // Company logo
  if (data.company.logoUrl) {
    const logoUrl = data.company.logoUrl.includes('cdn.filestac')
      ? data.company.logoUrl.replace(/RESIZE/i, 'resize=width:300/output=format:png')
      : data.company.logoUrl
    if (isValidImageUrl(logoUrl)) urls.add(logoUrl)
  }

  // Search & News Portals (remote ones)
  urls.add('https://cdn.newsramp.app/logos/duckduckgo.png')
  urls.add('https://cdn.newsramp.app/logos/Ground_News.png')
  urls.add('https://cdn.newsramp.app/newsworthy/yahoo_news_1.jpg')

  // Enhanced publications
  for (const pub of data.enhancedPublications) {
    const url = toPngUrl(pub.logo_url)
    if (isValidImageUrl(url)) urls.add(url)
  }

  // Boostify placements
  const nwr = data.nwrampReport
  if (nwr && nwr.placements) {
    for (const p of nwr.placements) {
      if (p.logo && p.logo.includes('http')) {
        const url = toPngUrl(p.logo)
        if (isValidImageUrl(url)) urls.add(url)
      } else if (p.placement) {
        const fallback = `https://cdn1.newsworthy.ai/images/clip_report/newsramp/${(p.placement || '').split('.')[0]}.png`
        urls.add(fallback)
      }
    }
    // Social images
    if (nwr.bluesky) urls.add('https://cdn.newsramp.app/bluesky.png')
    if (nwr.mastodon) urls.add('https://cdn.newsramp.app/mastodon.png')
    if (nwr.github) urls.add('https://cdn.newsramp.app/images/clip_report/newsramp/github.png')
    if (nwr.telegram_posts?.length) urls.add('https://cdn1.newsworthy.ai/images/clip_report/newsramp/telegram.png')

    // Podcast artwork
    if (nwr.podcasts) {
      for (const pod of nwr.podcasts) {
        if (pod.artwork && isValidImageUrl(pod.artwork)) urls.add(pod.artwork)
      }
    }

    // Podcast badges
    const badgeNames = ['apple-badge', 'iheart-badge', 'spotify-badge', 'pandora-badge', 'youtube-badge', 'castbox-badge', 'android-badge', 'podcast-index-badge', 'deezer']
    for (const name of badgeNames) {
      urls.add(`https://cdn.newsramp.app/badges/${name}.png`)
    }

    // Translation flags
    if (nwr.translations) {
      for (const t of nwr.translations) {
        const entries = Object.entries(t)
        if (entries.length > 0) {
          const [langName] = entries[0]
          urls.add(`https://cdn.newsramp.app/images/clip_report/translations/${langName.replace(/ /g, '-')}.png`)
        }
      }
    }

    // Blockchain QR
    if (nwr.blockchain_qrcode && isValidImageUrl(nwr.blockchain_qrcode)) {
      urls.add(nwr.blockchain_qrcode)
    }
  }

  // Research DB logos
  const researchLogos = ['gale', 'lexis-nexis', 'moodys', 'pro-quest', 'refinitive', 'thomson-reuters']
  for (const name of researchLogos) {
    urls.add(`https://cdn.newsramp.app/images/clip_report/${name}.png`)
  }

  // Distribution network clip logos
  const allClips = [...data.clips.gomedia, ...data.clips.synacor, ...data.clips.fcmarkets, ...data.clips.marketminute]
  for (const c of allClips) {
    if (c.logo && isValidImageUrl(c.logo)) urls.add(c.logo)
  }

  // Filter out URLs already in static map (by filename)
  const toFetch: string[] = []
  for (const url of urls) {
    const filename = url.split('/').pop() || ''
    if (!staticMap[filename]) {
      toFetch.push(url)
    }
  }

  // Fetch all remote images in parallel with a timeout
  const map: Record<string, string> = {}
  const results = await Promise.allSettled(
    toFetch.map(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return
        const buf = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || 'image/png'
        const dataUrl = `data:${contentType};base64,${buf.toString('base64')}`
        // Key by full URL so resolveImage can match
        map[url] = dataUrl
        // Also key by filename for backward compat
        const filename = url.split('/').pop() || ''
        if (filename) map[filename] = dataUrl
      } catch {
        // Silently skip failed fetches — text fallback will be used
      }
    })
  )

  return map
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params

  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })

  if (!release || release.status !== 'sent') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isAdminOrImpersonating = (session?.user as any)?.isAdmin || (session?.user as any)?.isImpersonating
  if (!isAdminOrImpersonating && release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  try {
    const data = await getReportData(uuid, false)
    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const staticMap = getStaticImageMap()
    const remoteMap = await prefetchRemoteImages(data, staticMap)
    const imageMap = { ...staticMap, ...remoteMap }

    const buffer = await renderToBuffer(
      React.createElement(ReportPdfDocument, { data, imageMap }) as any
    )

    const slug = release.slug || uuid
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="clip-report-${slug}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
