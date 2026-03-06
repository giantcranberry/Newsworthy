import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue } from '@/db/schema'
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
    const { queueId, editorId, editorName } = body

    await db.update(queue)
      .set({
        editorId,
        editorName,
        checkedout: new Date(),
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
