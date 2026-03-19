import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const { uuid } = await params

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (release.status !== 'review' && release.status !== 'hold' && release.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only releases in editorial review, on hold, or approved can be retracted' },
        { status: 400 }
      )
    }

    // Move back to draft status and clear review-related fields
    await db.update(releases)
      .set({
        status: 'draftnxt',
        score: 0,
        isFeatured: false,
        approvedAt: null,
      })
      .where(eq(releases.id, release.id))

    // Remove queue entry
    const queueEntry = await db.query.queue.findFirst({
      where: eq(queue.releaseId, release.id),
    })
    if (queueEntry) {
      await db.delete(queue).where(eq(queue.id, queueEntry.id))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error retracting release:', error)
    return NextResponse.json(
      { error: 'Failed to retract release' },
      { status: 500 }
    )
  }
}
