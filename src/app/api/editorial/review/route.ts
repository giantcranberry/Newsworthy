import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, releaseNotes, releaseEnhanced } from '@/db/schema'
import { eq } from 'drizzle-orm'

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
          score: score ? parseFloat(score) : null,
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

      return NextResponse.json({ success: true, action: 'rejected' })

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing review:', error)
    return NextResponse.json(
      { error: 'Failed to process review' },
      { status: 500 }
    )
  }
}
