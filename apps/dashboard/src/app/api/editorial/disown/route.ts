import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releaseNotes } from '@/db/schema'
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
    const { queueId, releaseId, editorId, editorName, notes } = body

    // Clear editor assignment and checkout timestamp
    await db.update(queue)
      .set({
        editorId: null,
        editorName: '',
        checkedout: null,
      })
      .where(eq(queue.id, queueId))

    // Add a note about the disown
    await db.insert(releaseNotes).values({
      prId: releaseId,
      note: notes || 'Returned to queue by editor',
      fromId: editorId,
      fromName: editorName,
      createdAt: new Date(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disowning queue item:', error)
    return NextResponse.json(
      { error: 'Failed to return to queue' },
      { status: 500 }
    )
  }
}
