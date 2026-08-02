import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue, company, brandCredits, users, verify } from '@/db/schema'
import { eq, and, or, isNull, gt, inArray, sql } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPostHog } from '@/lib/posthog'
import { sendSmsNotification } from '@/lib/twilio'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getPodcastCreditsForCompany } from '@/lib/podcasts/access'
import { sendVerificationEmail } from '@/lib/email'
import { isInsufficientCreditsDbError } from '@/lib/brand-credits'
import { prCreditScopes, qualifiesForFreeFirstPr } from '@/lib/pr-checkout'

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

    // Upgrades selected at the wizard but not yet paid must be settled (or
    // removed) in the finalize checkout before the release can be submitted.
    if (!isPodcastSourced && release.pendingUpgrades) {
      return NextResponse.json(
        {
          error: 'Selected upgrades have not been paid for yet. Complete the checkout or remove the upgrades before submitting.',
          code: 'payment_required',
        },
        { status: 402 }
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

    if (body.timezone) {
      updateData.timezone = body.timezone
    }

    // Flip status and record the credit deduction atomically. Without the
    // transaction a partial failure could leave the release in 'review'
    // without a corresponding -1 row, granting a free editorial submit.
    //
    // We also re-check the balance inside the transaction with row locks on
    // the existing credit rows for the scope being charged. That serializes
    // concurrent finalize calls against the same balance and prevents a race
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
        } else {
          // Manual releases consume a 'pr' credit at editorial submit. Skip
          // the charge when this release already carries a deduction — that
          // covers resubmissions after an editorial return and drafts created
          // under the old charge-at-creation model.
          const alreadyCharged = await tx
            .select({ id: brandCredits.id })
            .from(brandCredits)
            .where(
              and(
                eq(brandCredits.prId, release.id),
                sql`${brandCredits.credits} < 0`,
                inArray(brandCredits.productType, ['pr', 'credits']),
              ),
            )
            .limit(1)

          if (alreadyCharged.length === 0) {
            // Charge the first scope holding a positive balance: brand-level
            // before account-level, 'pr' before the legacy 'credits' type.
            // The deduction row must land in the scope that actually holds
            // the balance or the nonnegative trigger rejects it.
            const scopes = prCreditScopes(release.companyId).map(
              ([companyId, productType]) => ({ companyId, productType }),
            )

            const now = new Date()
            let charged = false
            for (const scope of scopes) {
              const lockedRows = await tx
                .select({ credits: brandCredits.credits })
                .from(brandCredits)
                .where(
                  and(
                    eq(brandCredits.userId, userId),
                    scope.companyId === null
                      ? isNull(brandCredits.companyId)
                      : eq(brandCredits.companyId, scope.companyId),
                    eq(brandCredits.productType, scope.productType),
                    or(isNull(brandCredits.expiresAt), gt(brandCredits.expiresAt, now)),
                  ),
                )
                .for('update')
              const balance = lockedRows.reduce((sum, r) => sum + (r.credits || 0), 0)
              if (balance > 0) {
                await tx.insert(brandCredits).values({
                  userId,
                  companyId: scope.companyId,
                  prId: release.id,
                  credits: -1,
                  productType: scope.productType,
                  notes: 'editorial submit',
                })
                charged = true
                break
              }
            }

            if (!charged) {
              // First-press-release-free offer: while the admin toggle is on,
              // a user with zero credits and no press releases gets this
              // submit free — grant the credit and consume it in one step so
              // the ledger shows both the offer and the charge.
              if (await qualifiesForFreeFirstPr(userId)) {
                await tx.insert(brandCredits).values({
                  userId,
                  companyId: null,
                  prId: null,
                  credits: 1,
                  productType: 'pr',
                  notes: 'first release free',
                })
                await tx.insert(brandCredits).values({
                  userId,
                  companyId: null,
                  prId: release.id,
                  credits: -1,
                  productType: 'pr',
                  notes: 'editorial submit',
                })
                charged = true
              }
            }

            if (!charged) {
              throw new InsufficientCreditsError()
            }
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
          isPodcastSourced
            ? { error: 'No podcast PR credits available. Add credits before submitting.' }
            : {
                error: 'No press release credits available. Purchase a credit to submit this release.',
                code: 'no_pr_credit',
              },
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

    // Verification is advisory, not a submission gate: if the submitter's
    // email is still unverified, re-send a fresh verification link so it's
    // at the top of their inbox. Never blocks or fails the submit.
    try {
      const submitter = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { email: true, emailVerified: true, },
      })
      if (submitter && !submitter.emailVerified) {
        const token = uuidv4().replace(/-/g, '')
        await db.insert(verify).values({
          userId,
          uuid: token,
          verified: false,
          createdAt: new Date(),
        })
        await sendVerificationEmail(submitter.email, token, submitter.email)
      }
    } catch (verifyErr) {
      console.error('Failed to re-send verification email at submit:', verifyErr)
    }

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
