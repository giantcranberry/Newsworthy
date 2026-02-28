import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getReportData } from '@/services/report'
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

    const imageMap = getStaticImageMap()
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
