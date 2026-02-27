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

  if (release.userId !== userId) {
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

    const buffer = await renderToBuffer(
      React.createElement(ReportPdfDocument, { data }) as any
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
