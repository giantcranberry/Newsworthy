import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releasePlacements, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getReportData, type ReportData, type ClipRecord } from '@/services/report'
import * as XLSX from 'xlsx'

function buildSummarySheet(data: ReportData) {
  const rows = [
    ['Clipping Report'],
    [],
    ['Company', data.company.companyName],
    ['Release Title', data.release.title || ''],
    ['Release Date', data.release.releasedAt ? new Date(data.release.releasedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''],
    ['Location', data.release.location || ''],
    [],
    ['Metrics'],
    ['Report Generated', new Date(data.fetchedAt).toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })],
    ['Effective CPC', `$${data.ecpc}`],
    ['Total Views', data.totalPv],
    ['Total Shares', data.totalSh],
    ['Total Engagement', data.totalPv + data.totalSh],
    ['PDF Downloads', data.pdfDownloadCount],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Widen columns
  ws['!cols'] = [{ wch: 20 }, { wch: 60 }]
  return ws
}

function buildClipsSheet(data: ReportData) {
  const header = ['Name', 'Category', 'City', 'State', 'Link']

  function mapClips(clips: ClipRecord[], category: string) {
    return clips.map((c) => [
      c.name || '',
      category,
      c.city || '',
      c.state || '',
      c.link || '',
    ])
  }

  const rows = [
    header,
    ...mapClips(data.clips.gomedia, 'Online Sources'),
    ...mapClips(data.clips.synacor, 'ISP Portals'),
    ...mapClips(data.clips.fcmarkets, 'Market Sources'),
    ...mapClips(data.clips.marketminute, 'Market Sources'),
  ]

  if (data.clips.redditNP) {
    rows.push([
      data.clips.redditNP.name || '',
      'Reddit',
      data.clips.redditNP.city || '',
      data.clips.redditNP.state || '',
      data.clips.redditNP.link || '',
    ])
  }

  if (data.clips.streetinsiderUrl) {
    rows.push(['StreetInsider', 'Market Sources', '', '', data.clips.streetinsiderUrl])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 60 }]
  return ws
}

function buildTimeSeriesSheet(data: ReportData) {
  const header = ['Date', 'Views', 'Shares']
  const rows = [
    header,
    ...data.combStats.map((s) => [s.key_as_string, s.views, s.shares]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }]
  return ws
}

function buildEnhancedSheet(data: ReportData) {
  const header = ['Publication', 'Link']
  const rows = [
    header,
    ...data.enhancedPublications.map((p) => [p.name, p.link]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 35 }, { wch: 60 }]
  return ws
}

function toDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function buildPlacementsSheet(data: ReportData) {
  const header = ['Platform', 'Link']
  const rows: (string | number)[][] = [header]

  const nwr = data.nwrampReport
  if (nwr) {
    if (nwr.placements) {
      for (const p of nwr.placements) {
        if (p.url && p.placement !== 'https://newswriter.ai/news' && p.handle !== 'threads' && p.handle !== 'x') {
          const name = p.placement ? toDomain(p.placement) : ''
          rows.push([name, p.url || ''])
        }
      }
    }
    if (nwr.linkedin) rows.push(['LinkedIn', nwr.linkedin])
    const xUrl = nwr.x || nwr.placements?.find((p: { handle?: string }) => p.handle === 'x')?.url
    if (xUrl) rows.push(['X', xUrl])
    if (nwr.telegram_posts?.length) rows.push(['Telegram', nwr.telegram_posts[0]])
    if (nwr.bluesky) rows.push(['Bluesky', nwr.bluesky])
    if (nwr.mastodon) rows.push(['Mastodon', nwr.mastodon])
    const threadsUrl = nwr.threads || nwr.placements?.find((p: { handle?: string }) => p.handle === 'threads')?.url
    if (threadsUrl) rows.push(['Threads', threadsUrl])
    if (nwr.github) rows.push(['GitHub', nwr.github])
    if (nwr.substack) rows.push(['Substack', nwr.substack])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 60 }]
  return ws
}

function buildAllPlacementsSheet(placements: { name: string | null; link: string | null; imageUrl: string | null; reach: string | null; isTarget: boolean | null }[]) {
  const header = ['Publication', 'Link', 'Reach', 'Target']
  const rows: (string | number | boolean)[][] = [
    header,
    ...placements.map((p) => [
      p.name || '',
      p.link || '',
      p.reach || '',
      p.isTarget ? 'Yes' : 'No',
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 35 }, { wch: 60 }, { wch: 15 }, { wch: 8 }]
  return ws
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
      // Allow partner managers to view reports for users in their managed partnerships
      const managedPartnerIds = ((session?.user as any)?.managedPartnerIds as number[] | undefined) || []
      let allowed = false
      if (managedPartnerIds.length > 0) {
        const owner = await db.query.users.findFirst({
          where: eq(users.id, release.userId),
          columns: { partnerId: true },
        })
        if (owner?.partnerId && managedPartnerIds.includes(owner.partnerId)) {
          allowed = true
        }
      }
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  try {
    const data = await getReportData(uuid, false)
    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), 'Summary')
    XLSX.utils.book_append_sheet(wb, buildClipsSheet(data), 'Distribution Clips')
    XLSX.utils.book_append_sheet(wb, buildTimeSeriesSheet(data), 'Time Series')

    if (data.enhancedPublications.length > 0) {
      XLSX.utils.book_append_sheet(wb, buildEnhancedSheet(data), 'Enhanced Publications')
    }

    if (data.nwrampReport) {
      XLSX.utils.book_append_sheet(wb, buildPlacementsSheet(data), 'Newsramp Placements')
    }

    const allPlacements = await db
      .select()
      .from(releasePlacements)
      .where(eq(releasePlacements.prid, release.id))

    if (allPlacements.length > 0) {
      XLSX.utils.book_append_sheet(wb, buildAllPlacementsSheet(allPlacements), 'All Placements')
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const slug = release.slug || uuid

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="clip-report-${slug}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('XLS generation error:', error)
    return NextResponse.json({ error: 'Failed to generate spreadsheet' }, { status: 500 })
  }
}
