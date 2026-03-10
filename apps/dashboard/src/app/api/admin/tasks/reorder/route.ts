import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks, kanbanStages, userProfiles } from '@/db/schema'
import { eq, and, isNull, sql, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { sendSystemMessageWithEmail } from '@/lib/messages'
import { sendSlackNotification, formatTaskStatusChangeMessage } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatTaskStatusChangeMessage } from '@/lib/google-chat'

// PUT: Move task between/within global stages
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

    // Verify target stage is a global stage
    const [targetStage] = await db
      .select({ id: kanbanStages.id })
      .from(kanbanStages)
      .where(and(eq(kanbanStages.id, stageId), isNull(kanbanStages.userId)))

    if (!targetStage) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
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

    // Notify task creator of stage change (if different from current user)
    const currentUserId = parseInt((session?.user as any)?.id)
    const [task] = await db
      .select({ createdBy: kanbanTasks.createdBy, title: kanbanTasks.title })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.id, taskId))

    if (task && task.createdBy && task.createdBy !== currentUserId) {
      const [stage] = await db
        .select({ name: kanbanStages.name })
        .from(kanbanStages)
        .where(eq(kanbanStages.id, stageId))

      const currentUserProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, currentUserId),
      })
      const changedByName = currentUserProfile?.firstName || 'Someone'
      const stageName = stage?.name || 'Unknown'
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthyai.com'

      sendSystemMessageWithEmail(
        task.createdBy,
        'Task Moved: ' + task.title,
        `<p>Your task <strong>${task.title}</strong> was moved to <strong>${stageName}</strong> by ${changedByName}.</p><p><a href="${appUrl}/admin/tasks">View Task Board</a></p>`
      ).catch(err => console.error('Failed to send task status change notification:', err))

      sendSlackNotification(task.createdBy, formatTaskStatusChangeMessage(task.title, stageName, changedByName))
        .catch(err => console.error('[Slack] task status change notification failed:', err))

      sendGoogleChatNotification(task.createdBy, formatGChatTaskStatusChangeMessage(task.title, stageName, changedByName))
        .catch(err => console.error('[GChat] task status change notification failed:', err))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordering task:', error)
    return NextResponse.json({ error: 'Failed to reorder task' }, { status: 500 })
  }
}
