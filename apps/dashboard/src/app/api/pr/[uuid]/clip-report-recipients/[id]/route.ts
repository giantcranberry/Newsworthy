import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, clipReportRecipients } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getAuthorizedRelease(uuid: string, userId: number) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    columns: { id: true, userId: true, companyId: true },
  })
  if (!release) return null
  if (release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) return null
  }
  return release
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uuid: string; id: string }> },
) {
  try {
    const session = await getEffectiveSession()
    const userId = parseInt(session?.user?.id || '0')
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { uuid, id: idParam } = await params
    const id = Number(idParam)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const release = await getAuthorizedRelease(uuid, userId)
    if (!release) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const [deleted] = await db
      .delete(clipReportRecipients)
      .where(
        and(
          eq(clipReportRecipients.id, id),
          eq(clipReportRecipients.releaseId, release.id),
        ),
      )
      .returning({ id: clipReportRecipients.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting clip report recipient:', error)
    return NextResponse.json(
      { error: 'Failed to remove recipient' },
      { status: 500 },
    )
  }
}
