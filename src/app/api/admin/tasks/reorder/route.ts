import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks } from '@/db/schema'
import { eq, and, gt, lt, gte, lte, ne, sql, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PUT: Move task between/within stages
export async function PUT(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { taskId, stageId, sortOrder } = await request.json()

    if (!taskId || stageId === undefined || sortOrder === undefined) {
      return NextResponse.json({ error: 'taskId, stageId, and sortOrder are required' }, { status: 400 })
    }

    // Update the task's stage and sort order
    await db
      .update(kanbanTasks)
      .set({
        stageId,
        sortOrder,
        updatedAt: sql`NOW()`,
      })
      .where(eq(kanbanTasks.id, taskId))

    // Re-normalize sort orders for the target stage
    const tasksInStage = await db
      .select({ id: kanbanTasks.id })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.stageId, stageId))
      .orderBy(asc(kanbanTasks.sortOrder), asc(kanbanTasks.id))

    for (let i = 0; i < tasksInStage.length; i++) {
      await db
        .update(kanbanTasks)
        .set({ sortOrder: i })
        .where(eq(kanbanTasks.id, tasksInStage[i].id))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering task:', error)
    return NextResponse.json({ error: 'Failed to reorder task' }, { status: 500 })
  }
}
