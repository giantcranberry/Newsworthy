import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanStages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { verifyStageOwnership } from '@/lib/kanban-auth'

// PUT: Reorder user's stages
export async function PUT(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)

  try {
    const { stageIds } = await request.json()

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json({ error: 'stageIds array is required' }, { status: 400 })
    }

    // Verify all stages belong to user
    for (const sid of stageIds) {
      if (!(await verifyStageOwnership(sid, uid))) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
      }
    }

    for (let i = 0; i < stageIds.length; i++) {
      await db
        .update(kanbanStages)
        .set({ sortOrder: i })
        .where(and(eq(kanbanStages.id, stageIds[i]), eq(kanbanStages.userId, uid)))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering stages:', error)
    return NextResponse.json({ error: 'Failed to reorder stages' }, { status: 500 })
  }
}
