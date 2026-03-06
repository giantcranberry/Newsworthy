import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanStages } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PUT: Reorder global stages (admin only)
export async function PUT(request: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { stageIds } = await request.json()

    if (!Array.isArray(stageIds) || stageIds.length === 0) {
      return NextResponse.json({ error: 'stageIds array is required' }, { status: 400 })
    }

    // Update sort order for each global stage
    for (let i = 0; i < stageIds.length; i++) {
      await db
        .update(kanbanStages)
        .set({ sortOrder: i })
        .where(and(eq(kanbanStages.id, stageIds[i]), isNull(kanbanStages.userId)))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering stages:', error)
    return NextResponse.json({ error: 'Failed to reorder stages' }, { status: 500 })
  }
}
