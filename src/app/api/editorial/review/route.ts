import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, releaseNotes } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth()

  // Check if user has editorial access
  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isEditor && !isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, queueId, action, notes, editorId, editorName } = body

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

      // Update release status to approved
      await db.update(releases)
        .set({
          status: 'approved',
        })
        .where(eq(releases.id, releaseId))

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

    } else if (action === 'reject') {
      // Update queue record with return timestamp
      await db.update(queue)
        .set({
          returned: now,
          editorId,
          editorName,
        })
        .where(eq(queue.id, queueId))

      // Update release status back to draft
      await db.update(releases)
        .set({
          status: 'draft',
        })
        .where(eq(releases.id, releaseId))

      // Add editor notes (required for rejection)
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
