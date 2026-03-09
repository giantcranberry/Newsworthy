import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPostHog } from '@/lib/posthog'
import { sendSmsNotification } from '@/lib/twilio'

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
    if (release.status === 'review' || release.status === 'approved' || release.status === 'published' || release.status === 'sent') {
      return NextResponse.json(
        { error: 'Release has already been submitted' },
        { status: 400 }
      )
    }

    // Update release date if provided
    const body = await request.json().catch(() => ({}))
    const updateData: Record<string, any> = { status: 'review' }

    if (body.releaseAt) {
      const newDate = new Date(body.releaseAt)
      if (!isNaN(newDate.getTime())) {
        updateData.releaseAt = newDate
      }
    }

    await db.update(releases)
      .set(updateData)
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
        .set({ submitted: new Date(), approved: null, returned: null, checkedout: null, editorId: null, editorName: '' })
        .where(eq(queue.releaseId, release.id))
    }

    // SMS notification (non-blocking)
    sendSmsNotification(`PR submitted for review: "${release.title}"`)

    getPostHog().capture({
      distinctId: String(userId),
      event: 'press_release_submitted',
      properties: {
        release_uuid: release.uuid,
        release_id: release.id,
        company_id: release.companyId,
        is_resubmission: !!existingQueue,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error finalizing release:', error)
    getPostHog().captureException(error, String(userId))
    return NextResponse.json(
      { error: 'Failed to submit release' },
      { status: 500 }
    )
  }
}
