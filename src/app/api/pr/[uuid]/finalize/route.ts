import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

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
    // Find the release
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check if already submitted
    if (release.status === 'editorial' || release.status === 'approved' || release.status === 'published' || release.status === 'sent') {
      return NextResponse.json(
        { error: 'Release has already been submitted' },
        { status: 400 }
      )
    }

    // Update status to editorial
    await db.update(releases)
      .set({ status: 'editorial' })
      .where(eq(releases.id, release.id))

    // Create or update queue entry
    const existingQueue = await db.query.queue.findFirst({
      where: eq(queue.releaseId, release.id),
    })

    if (!existingQueue) {
      await db.insert(queue).values({
        uuid: uuidv4(),
        releaseId: release.id,
        submitted: new Date(),
      })
    } else {
      await db.update(queue)
        .set({ submitted: new Date(), approved: null, returned: null })
        .where(eq(queue.releaseId, release.id))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error finalizing release:', error)
    return NextResponse.json(
      { error: 'Failed to submit release' },
      { status: 500 }
    )
  }
}
