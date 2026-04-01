import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, adCampaigns, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { generateAdCopy } from '@/services/ad-copy-generator'
import { createSearchCampaign, getCampaignMetrics, getAdReviewStatus, enableCampaign, pauseCampaign } from '@/services/google-ads'
import { getPostHog } from '@/lib/posthog'
import { randomUUID } from 'crypto'

function isEditorialUser(session: any): boolean {
  return !!(session?.user?.isEditor || session?.user?.isAdmin)
}

function buildNewsUrl(release: { releaseAt: Date | null; id: number; slug: string | null }): string {
  if (!release.releaseAt || !release.slug) return `https://www.newsworthy.ai`
  const d = new Date(release.releaseAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

/**
 * GET - Get ad campaign status for a release
 */
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

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Check access: owner, team member, or editorial user
    if (release.userId !== userId && !isEditorialUser(session)) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get ad campaign for this release
    const campaign = await db.query.adCampaigns.findFirst({
      where: eq(adCampaigns.releaseId, release.id),
    })

    if (!campaign) {
      return NextResponse.json({ campaign: null })
    }

    return NextResponse.json({
      campaign: {
        uuid: campaign.uuid,
        status: campaign.status,
        budgetAmount: campaign.budgetAmount,
        amountSpent: campaign.amountSpent,
        impressions: campaign.impressions,
        clicks: campaign.clicks,
        headlines: campaign.headlines,
        descriptions: campaign.descriptions,
        keywords: campaign.keywords,
        finalUrl: campaign.finalUrl,
        policyStatus: campaign.policyStatus,
        policyTopics: campaign.policyTopics,
        campaignStartDate: campaign.campaignStartDate,
        campaignEndDate: campaign.campaignEndDate,
        createdAt: campaign.createdAt,
      },
    })
  } catch (error) {
    console.error('[API] Error fetching ad campaign:', error)
    return NextResponse.json({ error: 'Failed to fetch ad campaign' }, { status: 500 })
  }
}

/**
 * POST - Create an ad campaign for a release, or trigger Google Ads creation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
      with: { company: true },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Check access
    if (release.userId !== userId && !isEditorialUser(session)) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { action } = body

    if (action === 'create') {
      // Create a new ad campaign record (purchase step)
      const { budgetAmount = 10, paymentIntentId } = body

      // Check for existing campaign
      const existing = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.releaseId, release.id),
      })

      if (existing) {
        return NextResponse.json({ error: 'Ad campaign already exists for this release' }, { status: 400 })
      }

      const campaignUuid = randomUUID()
      const finalUrl = buildNewsUrl(release)

      const [newCampaign] = await db.insert(adCampaigns).values({
        uuid: campaignUuid,
        releaseId: release.id,
        companyId: release.companyId,
        userId,
        budgetAmount,
        finalUrl,
        status: 'pending',
        paymentIntentId: paymentIntentId || null,
        paidAt: paymentIntentId ? new Date() : null,
      }).returning()

      getPostHog().capture({
        distinctId: String(userId),
        event: 'ad_campaign_created',
        properties: {
          release_id: release.id,
          release_uuid: uuid,
          budget_amount: budgetAmount,
          campaign_uuid: campaignUuid,
        },
      })

      return NextResponse.json({ success: true, campaign: newCampaign })
    }

    if (action === 'launch') {
      // Generate ad copy and create Google Ads campaign
      // This is called when the release is published (status=sent)
      // or can be triggered manually by admin/editor
      if (!isEditorialUser(session)) {
        return NextResponse.json({ error: 'Only editors/admins can launch ad campaigns' }, { status: 403 })
      }

      const campaign = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.releaseId, release.id),
      })

      if (!campaign) {
        return NextResponse.json({ error: 'No ad campaign found for this release' }, { status: 404 })
      }

      if (campaign.status !== 'pending') {
        return NextResponse.json({ error: `Campaign is already in '${campaign.status}' state` }, { status: 400 })
      }

      // Mark as creating
      await db.update(adCampaigns)
        .set({ status: 'creating', updatedAt: new Date() })
        .where(eq(adCampaigns.id, campaign.id))

      try {
        // Generate ad copy from PR content
        const companyName = (release as any).company?.companyName || 'Company'
        const adCopy = await generateAdCopy({
          title: release.title || 'Press Release',
          abstract: release.abstract || '',
          body: release.body || '',
          companyName,
          location: release.location || undefined,
        })

        // Calculate campaign dates (start today, run for 30 days)
        const startDate = new Date()
        const endDate = new Date()
        endDate.setDate(endDate.getDate() + 30)

        const formatDate = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        const finalUrl = campaign.finalUrl || buildNewsUrl(release)

        // Create the Google Ads campaign
        const result = await createSearchCampaign({
          campaignName: `PR: ${(release.title || 'Press Release').substring(0, 60)} [${release.uuid}]`,
          budgetAmountUsd: campaign.budgetAmount,
          headlines: adCopy.headlines,
          descriptions: adCopy.descriptions,
          keywords: adCopy.keywords,
          finalUrl,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        })

        // Update campaign record with Google resource IDs and ad content
        await db.update(adCampaigns)
          .set({
            googleCampaignId: result.campaignId,
            googleAdGroupId: result.adGroupId,
            googleBudgetId: result.budgetId,
            headlines: adCopy.headlines,
            descriptions: adCopy.descriptions,
            keywords: adCopy.keywords,
            finalUrl,
            status: 'review',
            campaignStartDate: formatDate(startDate),
            campaignEndDate: formatDate(endDate),
            updatedAt: new Date(),
          })
          .where(eq(adCampaigns.id, campaign.id))

        getPostHog().capture({
          distinctId: String(userId),
          event: 'ad_campaign_launched',
          properties: {
            release_id: release.id,
            campaign_id: result.campaignId,
            budget_amount: campaign.budgetAmount,
          },
        })

        return NextResponse.json({
          success: true,
          googleCampaignId: result.campaignId,
          status: 'review',
        })
      } catch (error) {
        // Mark as failed
        await db.update(adCampaigns)
          .set({
            status: 'failed',
            policyTopics: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
            updatedAt: new Date(),
          })
          .where(eq(adCampaigns.id, campaign.id))

        console.error('[API] Failed to launch ad campaign:', error)
        getPostHog().captureException(error, String(userId))
        return NextResponse.json({ error: 'Failed to create Google Ads campaign' }, { status: 500 })
      }
    }

    if (action === 'pause' || action === 'enable') {
      if (!isEditorialUser(session)) {
        return NextResponse.json({ error: 'Only editors/admins can manage ad campaigns' }, { status: 403 })
      }

      const campaign = await db.query.adCampaigns.findFirst({
        where: eq(adCampaigns.releaseId, release.id),
      })

      if (!campaign?.googleCampaignId) {
        return NextResponse.json({ error: 'No active Google campaign found' }, { status: 404 })
      }

      if (action === 'pause') {
        await pauseCampaign(campaign.googleCampaignId)
        await db.update(adCampaigns)
          .set({ status: 'paused', updatedAt: new Date() })
          .where(eq(adCampaigns.id, campaign.id))
      } else {
        await enableCampaign(campaign.googleCampaignId)
        await db.update(adCampaigns)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(adCampaigns.id, campaign.id))
      }

      return NextResponse.json({ success: true, status: action === 'pause' ? 'paused' : 'active' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error processing ad campaign:', error)
    getPostHog().captureException(error, String(userId))
    return NextResponse.json({ error: 'Failed to process ad campaign' }, { status: 500 })
  }
}
