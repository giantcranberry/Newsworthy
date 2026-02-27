import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq, or, inArray } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getReportData } from '@/services/report'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const isPublic = request.nextUrl.searchParams.get('public') === 'true'
  const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

  if (!isPublic) {
    const session = await getEffectiveSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = parseInt(session.user.id)

    // Verify ownership or company access
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  try {
    const data = await getReportData(uuid, refresh)
    if (!data) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Report API error:', error)
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 })
  }
}
