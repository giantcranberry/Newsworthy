import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getReportData } from '@/services/report'
import { buildClipReportWorkbook } from '@/lib/clip-report-xls'
import * as XLSX from 'xlsx'

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
    const data = await getReportData(uuid, false, request.nextUrl.searchParams.get('fetchedAt'))
    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const wb = buildClipReportWorkbook(data)
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
