import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { adCampaigns, releases, company } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { getAdReviewStatus, getCampaignMetrics, enableCampaign } from '@/services/google-ads'
import { getPostHog } from '@/lib/posthog'

/**
 * POST /api/cron/ads
 * Periodic job to:
 * 1. Check ad review status for campaigns in 'review' state
 * 2. Enable approved campaigns
 * 3. Update metrics (spend, impressions, clicks) for active campaigns
 * 4. Mark completed campaigns (budget exhausted or end date passed)
 *
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    reviewed: 0,
    enabled: 0,
    disapproved: 0,
    metricsUpdated: 0,
    completed: 0,
    errors: [] as string[],
  }

  try {
    // 1. Check campaigns in 'review' status
    const reviewCampaigns = await db
      .select()
      .from(adCampaigns)
      .where(eq(adCampaigns.status, 'review'))

    for (const campaign of reviewCampaigns) {
      if (!campaign.googleCampaignId) continue

      try {
        const adStatuses = await getAdReviewStatus(campaign.googleCampaignId)
        results.reviewed++

        // Check if all ads are approved
        const allApproved = adStatuses.length > 0 && adStatuses.every(
          ad => ad.approvalStatus === 'APPROVED' || ad.approvalStatus === 'APPROVED_LIMITED'
        )
        const anyDisapproved = adStatuses.some(
          ad => ad.approvalStatus === 'DISAPPROVED'
        )

        if (allApproved) {
          // Enable the campaign
          await enableCampaign(campaign.googleCampaignId)
          await db.update(adCampaigns)
            .set({
              status: 'active',
              policyStatus: 'APPROVED',
              updatedAt: new Date(),
            })
            .where(eq(adCampaigns.id, campaign.id))
          results.enabled++

          getPostHog().capture({
            distinctId: String(campaign.userId),
            event: 'ad_campaign_approved',
            properties: {
              campaign_uuid: campaign.uuid,
              release_id: campaign.releaseId,
            },
          })
        } else if (anyDisapproved) {
          const disapprovedAd = adStatuses.find(ad => ad.approvalStatus === 'DISAPPROVED')
          await db.update(adCampaigns)
            .set({
              status: 'disapproved',
              policyStatus: 'DISAPPROVED',
              policyTopics: disapprovedAd?.policyTopics || [],
              updatedAt: new Date(),
            })
            .where(eq(adCampaigns.id, campaign.id))
          results.disapproved++

          getPostHog().capture({
            distinctId: String(campaign.userId),
            event: 'ad_campaign_disapproved',
            properties: {
              campaign_uuid: campaign.uuid,
              release_id: campaign.releaseId,
              policy_topics: disapprovedAd?.policyTopics,
            },
          })
        }
        // If still under review, leave status as 'review'
      } catch (err) {
        const msg = `Failed to check review status for campaign ${campaign.uuid}: ${err}`
        console.error('[Cron/Ads]', msg)
        results.errors.push(msg)
      }
    }

    // 2. Update metrics for active campaigns
    const activeCampaigns = await db
      .select()
      .from(adCampaigns)
      .where(inArray(adCampaigns.status, ['active', 'review']))

    for (const campaign of activeCampaigns) {
      if (!campaign.googleCampaignId) continue

      try {
        const metrics = await getCampaignMetrics(campaign.googleCampaignId)
        const amountSpentUsd = metrics.costMicros / 1_000_000

        const updates: Record<string, any> = {
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          amountSpent: String(amountSpentUsd.toFixed(2)),
          updatedAt: new Date(),
        }

        // Check if budget is exhausted or campaign ended
        const budgetExhausted = amountSpentUsd >= campaign.budgetAmount
        const endDatePassed = campaign.campaignEndDate && new Date(campaign.campaignEndDate) < new Date()

        if ((budgetExhausted || endDatePassed) && campaign.status === 'active') {
          updates.status = 'completed'
          results.completed++

          getPostHog().capture({
            distinctId: String(campaign.userId),
            event: 'ad_campaign_completed',
            properties: {
              campaign_uuid: campaign.uuid,
              release_id: campaign.releaseId,
              total_spent: amountSpentUsd,
              impressions: metrics.impressions,
              clicks: metrics.clicks,
              reason: budgetExhausted ? 'budget_exhausted' : 'end_date_passed',
            },
          })
        }

        await db.update(adCampaigns)
          .set(updates)
          .where(eq(adCampaigns.id, campaign.id))
        results.metricsUpdated++
      } catch (err) {
        const msg = `Failed to update metrics for campaign ${campaign.uuid}: ${err}`
        console.error('[Cron/Ads]', msg)
        results.errors.push(msg)
      }
    }

    // 3. Check for pending campaigns whose releases are already sent
    const pendingCampaigns = await db
      .select({
        campaign: adCampaigns,
        releaseStatus: releases.status,
        releaseUuid: releases.uuid,
      })
      .from(adCampaigns)
      .innerJoin(releases, eq(adCampaigns.releaseId, releases.id))
      .where(eq(adCampaigns.status, 'pending'))

    for (const { campaign, releaseStatus, releaseUuid } of pendingCampaigns) {
      if (releaseStatus === 'sent' || releaseStatus === 'approved') {
        // This campaign was pending but the release is already published
        // Trigger launch via internal API call
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
          // Use internal fetch with cron secret as auth
          await fetch(`${appUrl}/api/pr/${releaseUuid}/ads`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Cron-Secret': process.env.CRON_SECRET || '',
            },
            body: JSON.stringify({ action: 'launch' }),
          })
        } catch (err) {
          console.error(`[Cron/Ads] Failed to trigger launch for pending campaign ${campaign.uuid}:`, err)
        }
      }
    }

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error('[Cron/Ads] Fatal error:', error)
    getPostHog().captureException(error)
    return NextResponse.json({ error: 'Cron job failed', details: results }, { status: 500 })
  }
}
