import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    if (release.status !== 'editorial') {
      return NextResponse.json(
        { error: 'Only releases in editorial review can be retracted' },
        { status: 400 }
      )
    }

    // Check that the release is not checked out to an editor
    const queueEntry = await db.query.queue.findFirst({
      where: eq(queue.releaseId, release.id),
    })

    if (queueEntry?.checkedout) {
      return NextResponse.json(
        { error: 'This release is currently being reviewed by an editor and cannot be retracted' },
        { status: 409 }
      )
    }

    // Move back to draft status
    await db.update(releases)
      .set({ status: 'draftnxt' })
      .where(eq(releases.id, release.id))

    // Remove queue entry
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
