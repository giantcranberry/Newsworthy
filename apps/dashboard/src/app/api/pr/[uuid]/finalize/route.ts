import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue, company, brandCredits } from '@/db/schema'
import { eq, and, or, isNull, gt, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPostHog } from '@/lib/posthog'
import { sendSmsNotification } from '@/lib/twilio'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getPodcastCreditsForCompany } from '@/lib/podcasts/access'

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
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Validate required fields before allowing submission
    const missingFields: string[] = []
    if (!release.title) missingFields.push('title')
    if (!release.abstract) missingFields.push('abstract')
    if (!release.body) missingFields.push('body')
    if (!release.location) missingFields.push('location')
    if (!release.primaryContactId) missingFields.push('primaryContactId')
    if (!release.bannerId) missingFields.push('bannerId')

    // Check company logo
    const comp = await db.query.company.findFirst({
      where: eq(company.id, release.companyId),
      columns: { logoUrl: true },
    })
    if (!comp?.logoUrl) missingFields.push('companyLogo')

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: 'Missing required fields', missingFields },
        { status: 400 }
      )
    }

    // Check if already submitted
    if (release.status === 'review' || release.status === 'approved' || release.status === 'published' || release.status === 'sent') {
      return NextResponse.json(
        { error: 'Release has already been submitted' },
        { status: 400 }
      )
    }

    // Podcast-sourced PRs consume a podcast_pr credit at editorial submit.
    const isPodcastSourced = release.source === 'podcast'

    if (isPodcastSourced) {
      const { totalCredits } = await getPodcastCreditsForCompany(release.companyId)
      if (totalCredits <= 0) {
        return NextResponse.json(
          { error: 'No podcast PR credits available. Add credits before submitting.' },
          { status: 402 }
        )
      }
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

    if (body.timezone) {
      updateData.timezone = body.timezone
    }

    // Flip status and (for podcast-sourced PRs) record the credit deduction
    // atomically. Without the transaction a partial failure could leave the
    // release in 'review' without a corresponding -1 row, granting a free
    // editorial submit.
    //
    // We also re-check the balance inside the transaction with row locks on
    // the existing credit rows for this (company, podcast_pr). That serializes
    // concurrent finalize calls against the same brand and prevents a race
    // where two simultaneous submits both see balance=1 and both deduct,
    // resulting in balance=-1. The DB-side trigger
    // (drizzle/manual/2026-05-27-brand-credits-nonnegative.sql) is a backstop.
    try {
      await db.transaction(async (tx) => {
        if (isPodcastSourced) {
          const now = new Date()
          const lockedRows = await tx
            .select({ credits: brandCredits.credits })
            .from(brandCredits)
            .where(
              and(
                eq(brandCredits.companyId, release.companyId),
                eq(brandCredits.productType, 'podcast_pr'),
                or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
              ),
            )
            .for('update')
          const liveBalance = lockedRows.reduce((sum, r) => sum + (r.credits || 0), 0)
          if (liveBalance <= 0) {
            throw new InsufficientCreditsError()
          }
        }

        await tx.update(releases)
          .set(updateData)
          .where(eq(releases.id, release.id))

        if (isPodcastSourced) {
          await tx.insert(brandCredits).values({
            userId,
            companyId: release.companyId,
            prId: release.id,
            credits: -1,
            productType: 'podcast_pr',
            notes: 'editorial submit',
          })
        }
      })
    } catch (err) {
      if (err instanceof InsufficientCreditsError || isInsufficientCreditsDbError(err)) {
        return NextResponse.json(
          { error: 'No podcast PR credits available. Add credits before submitting.' },
          { status: 402 }
        )
      }
      throw err
    }

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

class InsufficientCreditsError extends Error {
  constructor() {
    super('INSUFFICIENT_CREDITS')
  }
}

// Detect the Postgres trigger raising 23514 (check_violation) with the
// INSUFFICIENT_BRAND_CREDITS message, which is the DB-side guard against any
// deduction that would push the brand balance below zero.
function isInsufficientCreditsDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; message?: string }
  return e.code === '23514' && typeof e.message === 'string' && e.message.includes('INSUFFICIENT_BRAND_CREDITS')
}
