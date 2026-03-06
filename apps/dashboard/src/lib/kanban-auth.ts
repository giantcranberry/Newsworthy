import { db } from '@/db'
import { kanbanTasks, kanbanStages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function verifyStageOwnership(stageId: number, userId: number): Promise<boolean> {
  const [stage] = await db
    .select({ id: kanbanStages.id })
    .from(kanbanStages)
    .where(and(eq(kanbanStages.id, stageId), eq(kanbanStages.userId, userId)))

  return !!stage
}

export async function verifyTaskOwnership(taskId: number, userId: number): Promise<boolean> {
  const [task] = await db
    .select({ id: kanbanTasks.id })
    .from(kanbanTasks)
    .innerJoin(kanbanStages, eq(kanbanTasks.stageId, kanbanStages.id))
    .where(and(eq(kanbanTasks.id, taskId), eq(kanbanStages.userId, userId)))

  return !!task
}
