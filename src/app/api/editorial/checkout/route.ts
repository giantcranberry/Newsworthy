import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue } from '@/db/schema'
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
    const { queueId, editorId, editorName } = body

    // Update queue with editor checkout
    await db.update(queue)
      .set({
        editorId,
        editorName,
      })
      .where(eq(queue.id, queueId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error checking out release:', error)
    return NextResponse.json(
      { error: 'Failed to check out release' },
      { status: 500 }
    )
  }
}
