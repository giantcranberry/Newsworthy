import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, releaseNotes, releaseEnhanced, users, userProfiles, postQueue, releaseOptions, releaseCategories, releaseRegions, company, images, banners, partners, adCampaigns } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { createSystemMessage } from '@/lib/messages'
import { sendSlackNotification, formatPrStatusMessage } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatPrStatusMessage } from '@/lib/google-chat'
import { getPostHog } from '@/lib/posthog'
import { normalizeTimezone, tzLabel } from '@/lib/timezones'
import { indexDocument, updateDocument } from '@/lib/opensearch'
import { randomUUID } from 'crypto'

const CIRCUITS: Record<string, number[]> = {
  hr: [29, 34, 216, 217, 218, 219, 221, 254, 260],
  cannadellic: [125, 237, 236],
  cannabis: [125, 237],
  psychedelics: [236],
}

export async function POST(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, queueId, action, notes, editorId, editorName, score, distribution, feature, adSpend } = body

    const now = new Date()

    if (action === 'approve') {
      // Update queue record
      await db.update(queue)
        .set({
          approved: now,
          editorId,
          editorName,
        })
        .where(eq(queue.id, queueId))

      // Update release status to approved with score, distribution, feature
      await db.update(releases)
        .set({
          status: 'approved',
          approvedAt: now,
          score: score ? Math.max(2, Math.min(5, parseInt(score, 10))) : 4,
          distribution: distribution || 'standard',
          isFeatured: feature || false,
        })
        .where(eq(releases.id, releaseId))

      // Create releases_enhanced record if distribution is enhanced or yahoo
      if (distribution && distribution !== 'standard') {
        const existing = await db
          .select()
          .from(releaseEnhanced)
          .where(eq(releaseEnhanced.prid, releaseId))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(releaseEnhanced).values({
            prid: releaseId,
            createdAt: now,
          })
        }
      }

      // Index release in OpenSearch nw_releases
      try {
        const [rel] = await db
          .select({
            id: releases.id,
            uuid: releases.uuid,
            title: releases.title,
            abstract: releases.abstract,
            body: releases.body,
            location: releases.location,
            releaseAt: releases.releaseAt,
            slug: releases.slug,
            userId: releases.userId,
            companyId: releases.companyId,
            elasticDoc: releases.elasticDoc,
          })
          .from(releases)
          .where(eq(releases.id, releaseId))

        const [comp] = await db
          .select({ uuid: company.uuid })
          .from(company)
          .where(eq(company.id, rel.companyId))

        // Get partner handle
        const [usr] = await db
          .select({ partnerId: users.partnerId })
          .from(users)
          .where(eq(users.id, rel.userId))

        let partnerHandle = 'newsworthy'
        if (usr?.partnerId) {
          const [p] = await db
            .select({ handle: partners.handle })
            .from(partners)
            .where(eq(partners.id, usr.partnerId))
          if (p?.handle) partnerHandle = p.handle
        }

        // Get primary image and banner
        const [primaryImg] = await db
          .select({ url: images.url })
          .from(images)
          .innerJoin(releases, eq(releases.primaryImageId, images.id))
          .where(eq(releases.id, releaseId))

        const [banner] = await db
          .select({ url: banners.url })
          .from(banners)
          .innerJoin(releases, eq(releases.bannerId, banners.id))
          .where(eq(releases.id, releaseId))

        // Get categories and regions
        const cats = await db
          .select({ categoryId: releaseCategories.categoryId })
          .from(releaseCategories)
          .where(eq(releaseCategories.releaseId, releaseId))

        const regs = await db
          .select({ regionId: releaseRegions.regionId })
          .from(releaseRegions)
          .where(eq(releaseRegions.releaseId, releaseId))

        const categoryIds = cats.map(c => c.categoryId)
        const regionIds = regs.map(r => r.regionId)

        // Compute circuits from categories
        const circuitNames: string[] = []
        for (const [name, catIds] of Object.entries(CIRCUITS)) {
          if (categoryIds.some(id => catIds.includes(id))) {
            circuitNames.push(name)
          }
        }

        // Build dateline
        let dateline = ''
        if (rel.releaseAt) {
          const d = new Date(rel.releaseAt)
          dateline = `${rel.location || ''} - ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
        }

        // Build news URL
        let newsUrlStr = ''
        if (rel.releaseAt && rel.slug) {
          const d = new Date(rel.releaseAt)
          const y = d.getFullYear()
          const m = String(d.getMonth() + 1).padStart(2, '0')
          const day = String(d.getDate()).padStart(2, '0')
          newsUrlStr = `https://newsworthy.ai/news/${y}${m}${day}${rel.id}/${rel.slug}`
        }

        const content: Record<string, unknown> = {
          pr_id: rel.id,
          created_at: now.toISOString(),
          release_at: rel.releaseAt ? new Date(rel.releaseAt).toISOString() : null,
          headline: rel.title,
          abstract: rel.abstract,
          location: rel.location,
          partner: partnerHandle,
          body: rel.body,
          pr_uuid: rel.uuid,
          dateline,
          edscore: score ? Math.max(2, Math.min(5, parseInt(score, 10))) : 4,
          user_id: rel.userId,
          company_id: rel.companyId,
          company_uuid: comp?.uuid || null,
          url: newsUrlStr,
          regions: regionIds,
          categories: categoryIds,
          circuits: circuitNames,
          placements: [partnerHandle],
        }

        if (primaryImg?.url) {
          content.news_image = primaryImg.url.replace('/RESIZE/', '/resize=w:500/')
        }
        if (banner?.url) {
          content.og_image = banner.url.replace('/RESIZE/', '/resize=w:1200/')
        }

        if (rel.elasticDoc) {
          await updateDocument('nw_releases', rel.elasticDoc, content)
        } else {
          const res = await indexDocument('nw_releases', content)
          if (res?._id) {
            await db.update(releases)
              .set({ elasticDoc: res._id })
              .where(eq(releases.id, releaseId))
          }
        }
      } catch (err) {
        console.error('Failed to index release in OpenSearch:', err)
      }

      // Add editor notes if provided
      if (notes && notes.trim()) {
        await db.insert(releaseNotes).values({
          prId: releaseId,
          note: `[Approved] ${notes}`,
          fromId: editorId,
          fromName: editorName,
          createdAt: now,
        })
      }

      // Notify the release owner
      try {
        const [release] = await db
          .select({
            userId: releases.userId,
            title: releases.title,
            releaseAt: releases.releaseAt,
            timezone: releases.timezone,
          })
          .from(releases)
          .where(eq(releases.id, releaseId))

        if (release) {
          const headline = release.title || 'Untitled'
          let dateStr = 'soon'
          if (release.releaseAt) {
            const tz = normalizeTimezone(release.timezone)
            dateStr = new Intl.DateTimeFormat('en-US', {
              dateStyle: 'full',
              timeStyle: 'short',
              timeZone: tz,
            }).format(new Date(release.releaseAt)) + ` (${tzLabel(release.timezone)})`
          }

          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'

          // Inbox message
          await createSystemMessage(
            release.userId,
            `Release Approved: ${headline}`,
            `<p>Your press release <strong>${headline}</strong> has been approved and will be distributed on ${dateStr}.</p><p><a href="${appUrl}/pr">View Your Releases</a></p>`
          )

          // Email
          const [owner] = await db
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, release.userId))

          const [profile] = await db
            .select({ firstName: userProfiles.firstName })
            .from(userProfiles)
            .where(eq(userProfiles.userId, release.userId))

          if (owner) {
            const recipientName = profile?.firstName || owner.email
            await sendEmail({
              to: owner.email,
              subject: `Your press release has been approved`,
              html: `
                <!DOCTYPE html>
                <html>
                  <head><meta charset="utf-8"><title>Release Approved</title></head>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 8px;">
                      <h1 style="color: #1a1a1a; margin-bottom: 20px;">Release Approved</h1>
                      <p>Hi ${recipientName},</p>
                      <p>Your press release <strong>${headline}</strong> has been approved and will be distributed on ${dateStr}.</p>
                      <a href="${appUrl}/pr" style="display: inline-block; background-color: #155e75; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">View Your Releases</a>
                      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                      <p style="font-size: 12px; color: #999;">This email was sent from Newsworthy.</p>
                    </div>
                  </body>
                </html>
              `,
              text: `Hi ${recipientName},\n\nYour press release "${headline}" has been approved and will be distributed on ${dateStr}.\n\nView your releases: ${appUrl}/pr`,
            })
          }

          // Slack notification (best-effort)
          sendSlackNotification(release.userId, formatPrStatusMessage(headline, 'approved'))
            .catch(err => console.error('[Slack] approval notification failed:', err))

          // Google Chat notification (best-effort)
          sendGoogleChatNotification(release.userId, formatGChatPrStatusMessage(headline, 'approved'))
            .catch(err => console.error('[GChat] approval notification failed:', err))
        }
      } catch (err) {
        console.error('Failed to send approval notification:', err)
      }

      // Create post_queue records for distribution processing
      try {
        const [releaseRow] = await db
          .select({ releaseAt: releases.releaseAt })
          .from(releases)
          .where(eq(releases.id, releaseId))

        const releaseAt = releaseRow?.releaseAt ?? null

        // Always create sms and email queue entries
        await db.insert(postQueue).values([
          { prid: releaseId, target: 'sms', subTarget: null, msg: '', releaseAt },
          { prid: releaseId, target: 'email', subTarget: null, msg: '', releaseAt },
        ])

        // Create advocacy queue entry if release options have advocacy enabled
        const [ro] = await db
          .select({ advocacy: releaseOptions.advocacy })
          .from(releaseOptions)
          .where(eq(releaseOptions.prId, releaseId))
          .limit(1)

        if (ro?.advocacy) {
          await db.insert(postQueue).values({
            prid: releaseId,
            target: 'advocacy',
            subTarget: null,
            msg: '',
            releaseAt,
          })
        }
      } catch (err) {
        console.error('Failed to create post_queue records:', err)
      }

      // Google Ads campaign: create if editor specified ad spend, or launch if user already purchased
      try {
        const [existingAd] = await db
          .select()
          .from(adCampaigns)
          .where(eq(adCampaigns.releaseId, releaseId))
          .limit(1)

        const [rel2] = await db
          .select({ uuid: releases.uuid, userId: releases.userId, companyId: releases.companyId })
          .from(releases)
          .where(eq(releases.id, releaseId))

        // If editor specified ad spend and no campaign exists, create one
        if (adSpend && adSpend > 0 && !existingAd && rel2) {
          await db.insert(adCampaigns).values({
            uuid: randomUUID(),
            releaseId,
            companyId: rel2.companyId,
            userId: rel2.userId,
            budgetAmount: adSpend,
            status: 'pending',
          })
        }

        // If editor specified ad spend and campaign exists, update the budget
        if (adSpend && adSpend > 0 && existingAd) {
          await db.update(adCampaigns)
            .set({ budgetAmount: adSpend, updatedAt: now })
            .where(eq(adCampaigns.id, existingAd.id))
        }

        // Launch the campaign (existing or newly created)
        const [adToLaunch] = await db
          .select()
          .from(adCampaigns)
          .where(eq(adCampaigns.releaseId, releaseId))
          .limit(1)

        if (adToLaunch && adToLaunch.status === 'pending' && rel2?.uuid) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
          fetch(`${appUrl}/api/pr/${rel2.uuid}/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') || '' },
            body: JSON.stringify({ action: 'launch' }),
          }).catch(err => console.error('[Ads] Failed to trigger ad campaign launch:', err))
        }
      } catch (err) {
        console.error('[Ads] Error processing ad campaign:', err)
      }

      getPostHog().capture({
        distinctId: String(editorId),
        event: 'press_release_approved',
        properties: {
          release_id: releaseId,
          queue_id: queueId,
          score: score ? parseInt(score, 10) : null,
          distribution,
          is_featured: feature || false,
        },
      })

      return NextResponse.json({ success: true, action: 'approved' })

    } else if (action === 'hold') {
      // Editorial hold - release goes to 'hold' status
      await db.update(queue)
        .set({
          returned: now,
          editorId,
          editorName,
        })
        .where(eq(queue.id, queueId))

      await db.update(releases)
        .set({ status: 'hold' })
        .where(eq(releases.id, releaseId))

      if (notes && notes.trim()) {
        await db.insert(releaseNotes).values({
          prId: releaseId,
          note: `[Hold] ${notes}`,
          fromId: editorId,
          fromName: editorName,
          createdAt: now,
        })
      }

      // Slack + Google Chat notification for hold (best-effort)
      try {
        const [holdRelease] = await db
          .select({ userId: releases.userId, title: releases.title })
          .from(releases)
          .where(eq(releases.id, releaseId))
        if (holdRelease) {
          sendSlackNotification(holdRelease.userId, formatPrStatusMessage(holdRelease.title || 'Untitled', 'on hold', notes))
            .catch(err => console.error('[Slack] hold notification failed:', err))
          sendGoogleChatNotification(holdRelease.userId, formatGChatPrStatusMessage(holdRelease.title || 'Untitled', 'on hold', notes))
            .catch(err => console.error('[GChat] hold notification failed:', err))
        }
      } catch (err) {
        console.error('[Slack/GChat] hold notification error:', err)
      }

      getPostHog().capture({
        distinctId: String(editorId),
        event: 'press_release_held',
        properties: {
          release_id: releaseId,
          queue_id: queueId,
          has_notes: !!(notes && notes.trim()),
        },
      })

      return NextResponse.json({ success: true, action: 'hold' })

    } else if (action === 'reject') {
      // Reject - release goes back to draft
      await db.update(queue)
        .set({
          returned: now,
          editorId,
          editorName,
        })
        .where(eq(queue.id, queueId))

      await db.update(releases)
        .set({ status: 'draft' })
        .where(eq(releases.id, releaseId))

      if (notes && notes.trim()) {
        await db.insert(releaseNotes).values({
          prId: releaseId,
          note: `[Rejected] ${notes}`,
          fromId: editorId,
          fromName: editorName,
          createdAt: now,
        })
      }

      // Slack + Google Chat notification for rejection (best-effort)
      try {
        const [rejectRelease] = await db
          .select({ userId: releases.userId, title: releases.title })
          .from(releases)
          .where(eq(releases.id, releaseId))
        if (rejectRelease) {
          sendSlackNotification(rejectRelease.userId, formatPrStatusMessage(rejectRelease.title || 'Untitled', 'needs revision', notes))
            .catch(err => console.error('[Slack] reject notification failed:', err))
          sendGoogleChatNotification(rejectRelease.userId, formatGChatPrStatusMessage(rejectRelease.title || 'Untitled', 'needs revision', notes))
            .catch(err => console.error('[GChat] reject notification failed:', err))
        }
      } catch (err) {
        console.error('[Slack/GChat] reject notification error:', err)
      }

      getPostHog().capture({
        distinctId: String(editorId),
        event: 'press_release_rejected',
        properties: {
          release_id: releaseId,
          queue_id: queueId,
          has_notes: !!(notes && notes.trim()),
        },
      })

      return NextResponse.json({ success: true, action: 'rejected' })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing review:', error)
    getPostHog().captureException(error)
    return NextResponse.json(
      { error: 'Failed to process review' },
      { status: 500 }
    )
  }
}
