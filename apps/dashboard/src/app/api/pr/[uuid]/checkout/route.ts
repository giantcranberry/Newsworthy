import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, brandCredits, adCampaigns } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sendPaymentReceiptEmail } from '@/lib/email'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getPostHog } from '@/lib/posthog'
import { randomUUID } from 'crypto'
import {
  releaseNeedsPrCredit,
  getPrCreditProduct,
  getPendingUpgradeProducts,
} from '@/lib/pr-checkout'

// Combined checkout for the finalize (Submit) step: one payment covering the
// PR credit the release needs plus any upgrades whose card payment was
// deferred at the Upgrades step. On confirmation the credit is granted to the
// user's account-level balance — the finalize route then deducts it when the
// release is submitted for review.

// Get the correct Stripe secret key based on environment
function getStripeSecretKey(host: string): string | undefined {
  const isSandbox = host.includes('localhost') || host.includes('vercel.app')
  if (isSandbox) {
    return process.env.STRIPE_SECRET_SANDBOX
  }
  return process.env.STRIPE_SECRET
}

async function getStripe() {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost'
  const stripeApiKey = getStripeSecretKey(host)
  if (!stripeApiKey) return null
  const Stripe = (await import('stripe')).default
  return new Stripe(stripeApiKey)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

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

    const body = await request.json()
    const { action } = body

    if (action === 'create_payment_intent') {
      const needsCredit = await releaseNeedsPrCredit(userId, release)
      const prProduct = needsCredit ? await getPrCreditProduct(partnerId) : null
      if (needsCredit && !prProduct) {
        return NextResponse.json(
          { error: 'No press release credit product is available for purchase' },
          { status: 500 }
        )
      }

      const upgradeProducts = await getPendingUpgradeProducts(release, partnerId)
      const amount =
        (prProduct?.price || 0) + upgradeProducts.reduce((sum, p) => sum + p.price, 0)

      if (amount <= 0) {
        return NextResponse.json({ error: 'Nothing to pay for' }, { status: 400 })
      }

      const stripe = await getStripe()
      if (!stripe) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      const itemNames = [
        ...(prProduct ? [prProduct.displayName || prProduct.shortName || 'Press Release Credit'] : []),
        ...upgradeProducts.map((p) => p.displayName || p.shortName || 'Upgrade'),
      ]
      const releaseTitle = release.title || 'Untitled Press Release'
      const description = `${itemNames.join(', ')} for "${releaseTitle}" (${uuid})`

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          purpose: 'finalize_checkout',
          releaseId: release.id.toString(),
          releaseUuid: uuid,
          releaseTitle: releaseTitle.substring(0, 500), // Stripe metadata limit
          userId: userId.toString(),
          prProductId: prProduct ? prProduct.id.toString() : '',
          prCredits: prProduct ? String(prProduct.productCredits ?? 1) : '0',
          upgradeTypes: upgradeProducts.map((p) => p.productType).join(','),
          productNames: itemNames.join(', ').substring(0, 500),
        },
        description,
      })

      return NextResponse.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      })
    }

    if (action === 'confirm_payment') {
      const { paymentIntentId } = body

      if (!paymentIntentId) {
        return NextResponse.json({ error: 'Payment intent ID required' }, { status: 400 })
      }

      const stripe = await getStripe()
      if (!stripe) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
      }

      if (
        paymentIntent.metadata?.releaseUuid !== uuid ||
        paymentIntent.metadata?.purpose !== 'finalize_checkout'
      ) {
        return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 })
      }

      // Grant the purchased PR credit at the account level (companyId null,
      // no prId — the finalize route records the consumption separately, and
      // deleting the release must never erase the purchase). The notes tag
      // keeps retries of this confirm call idempotent.
      const creditNote = `finalize ${paymentIntentId}`.substring(0, 48)
      if (paymentIntent.metadata.prProductId) {
        const grantedCredits = parseInt(paymentIntent.metadata.prCredits || '1', 10) || 1
        const existing = await db
          .select({ id: brandCredits.id })
          .from(brandCredits)
          .where(and(eq(brandCredits.userId, userId), eq(brandCredits.notes, creditNote)))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(brandCredits).values({
            userId,
            companyId: null,
            prId: null,
            credits: grantedCredits,
            productType: 'pr',
            notes: creditNote,
          })
        }
      }

      // Apply the paid upgrades: append to distribution (preserving upgrades
      // already redeemed with credits) and clear the pending selection.
      const upgradeTypes = (paymentIntent.metadata.upgradeTypes || '')
        .split(',')
        .filter(Boolean)
      const distributionTypes = upgradeTypes.filter((t) => t !== 'ads')

      const currentDistribution =
        release.distribution && release.distribution !== 'standard'
          ? release.distribution.split(',').filter(Boolean)
          : []
      for (const t of distributionTypes) {
        if (!currentDistribution.includes(t)) currentDistribution.push(t)
      }
      const newDistribution =
        currentDistribution.length > 0 ? currentDistribution.join(',') : release.distribution

      await db.update(releases)
        .set({ distribution: newDistribution, pendingUpgrades: null })
        .where(eq(releases.id, release.id))

      // If 'ads' was purchased, create an ad_campaigns record (same budget
      // rule as the Upgrades-step checkout: price minus 25% markup, min $10)
      if (upgradeTypes.includes('ads')) {
        const existingCampaign = await db
          .select({ id: adCampaigns.id })
          .from(adCampaigns)
          .where(eq(adCampaigns.paymentIntentId, paymentIntentId))
          .limit(1)

        if (existingCampaign.length === 0) {
          const paidProducts = await getPendingUpgradeProducts(
            { pendingUpgrades: upgradeTypes.join(',') },
            partnerId
          )
          const adsProduct = paidProducts.find((p) => p.productType === 'ads')
          const adBudget = adsProduct
            ? Math.max(10, Math.round((adsProduct.price / 100) * 0.75))
            : 10

          try {
            await db.insert(adCampaigns).values({
              uuid: randomUUID(),
              releaseId: release.id,
              companyId: release.companyId,
              userId,
              budgetAmount: adBudget,
              status: 'pending',
              paymentIntentId,
              paidAt: new Date(),
            })
          } catch (adError) {
            console.error('[API] Failed to create ad campaign record:', adError)
          }
        }
      }

      // Send receipt email
      const userEmail = session.user.email
      const userName = session.user.name || 'Customer'
      const releaseTitle = paymentIntent.metadata.releaseTitle || release.title || 'Press Release'
      const productNames = (paymentIntent.metadata.productNames || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)

      if (userEmail) {
        try {
          await sendPaymentReceiptEmail({
            to: userEmail,
            customerName: userName,
            releaseTitle,
            releaseUuid: uuid,
            productNames,
            amount: paymentIntent.amount,
            transactionId: paymentIntentId,
          })
        } catch (emailError) {
          // Log but don't fail the request if email fails
          console.error('[API] Failed to send receipt email:', emailError)
        }
      }

      getPostHog().capture({
        distinctId: String(userId),
        event: 'finalize_checkout_completed',
        properties: {
          release_uuid: uuid,
          release_id: release.id,
          company_id: release.companyId,
          amount: paymentIntent.amount,
          bought_pr_credit: !!paymentIntent.metadata.prProductId,
          upgrade_types: upgradeTypes,
        },
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error processing finalize checkout:', error)
    getPostHog().captureException(error, String(userId))
    return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 })
  }
}
