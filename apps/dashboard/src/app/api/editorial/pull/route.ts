import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue } from '@/db/schema'
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
    const { releaseId } = body

    if (!releaseId) {
      return NextResponse.json({ error: 'Release ID required' }, { status: 400 })
    }

    // Unwind approval: set release status back to draft, clear approval timestamp
    await db.update(releases)
      .set({
        status: 'draft',
        approvedAt: null,
        score: null,
        isFeatured: false,
      })
      .where(eq(releases.id, releaseId))

    // Clear queue approval timestamp
    const queueItems = await db
      .select()
      .from(queue)
      .where(eq(queue.releaseId, releaseId))
      .limit(1)

    if (queueItems.length > 0) {
      await db.update(queue)
        .set({ approved: null })
        .where(eq(queue.releaseId, releaseId))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error pulling release:', error)
    return NextResponse.json({ error: 'Failed to pull release' }, { status: 500 })
  }
}
