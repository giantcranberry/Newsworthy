import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, releaseNotes, releaseEnhanced, users, userProfiles, postQueue, releaseOptions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email'
import { createSystemMessage } from '@/lib/messages'
import { sendSlackNotification, formatPrStatusMessage } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatPrStatusMessage } from '@/lib/google-chat'
import { getPostHog } from '@/lib/posthog'
import { normalizeTimezone, tzLabel } from '@/lib/timezones'

export async function POST(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, queueId, action, notes, editorId, editorName, score, distribution, feature } = body

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
