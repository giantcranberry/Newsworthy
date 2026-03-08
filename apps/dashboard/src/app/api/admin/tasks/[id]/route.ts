import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks, kanbanTaskFiles, users, userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadTaskFile, deleteTaskFile } from '@/services/s3'
import { sendSystemMessageWithEmail } from '@/lib/messages'
import { sendSlackNotification, formatTaskAssignmentMessage } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatTaskAssignmentMessage } from '@/lib/google-chat'

// GET: Single task with files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  try {
    const [task] = await db
      .select({
        id: kanbanTasks.id,
        stageId: kanbanTasks.stageId,
        title: kanbanTasks.title,
        description: kanbanTasks.description,
        priority: kanbanTasks.priority,
        assignedTo: kanbanTasks.assignedTo,
        createdBy: kanbanTasks.createdBy,
        sortOrder: kanbanTasks.sortOrder,
        createdAt: kanbanTasks.createdAt,
        updatedAt: kanbanTasks.updatedAt,
        assigneeFirstName: userProfiles.firstName,
        assigneeLastName: userProfiles.lastName,
        assigneeEmail: users.email,
      })
      .from(kanbanTasks)
      .leftJoin(users, eq(kanbanTasks.assignedTo, users.id))
      .leftJoin(userProfiles, eq(kanbanTasks.assignedTo, userProfiles.userId))
      .where(eq(kanbanTasks.id, taskId))

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const files = await db
      .select()
      .from(kanbanTaskFiles)
      .where(eq(kanbanTaskFiles.taskId, taskId))

    return NextResponse.json({ ...task, files })
  } catch (error) {
    console.error('Error fetching task:', error)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

// PUT: Update a task
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  try {
    // Fetch existing task to detect assignee changes
    const [existingTask] = await db
      .select({ assignedTo: kanbanTasks.assignedTo })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.id, taskId))

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const priority = formData.get('priority') as string | null
    const stageId = formData.get('stageId') ? parseInt(formData.get('stageId') as string) : undefined
    const assignedTo = formData.get('assignedTo')
      ? parseInt(formData.get('assignedTo') as string)
      : formData.has('assignedTo') ? null : undefined

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const updates: Record<string, any> = {
      title: title.trim(),
      description,
      updatedAt: sql`NOW()`,
    }

    if (priority) updates.priority = priority
    if (stageId !== undefined) updates.stageId = stageId
    if (assignedTo !== undefined) updates.assignedTo = assignedTo

    const [task] = await db
      .update(kanbanTasks)
      .set(updates)
      .where(eq(kanbanTasks.id, taskId))
      .returning()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Notify if assignee changed to a new person (not self)
    const userId = parseInt((session?.user as any)?.id)
    if (assignedTo && assignedTo !== existingTask.assignedTo && assignedTo !== userId) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthyai.com'
      sendSystemMessageWithEmail(
        assignedTo,
        'Task Assigned: ' + title.trim(),
        `<p>You have been assigned a task: <strong>${title.trim()}</strong></p><p><a href="${appUrl}/admin/tasks">View Task Board</a></p>`
      ).catch(err => console.error('Failed to send task assignment notification:', err))

      // Slack notification (best-effort)
      const assignerProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
      })
      const assignerName = assignerProfile?.firstName || 'Someone'
      sendSlackNotification(assignedTo, formatTaskAssignmentMessage(title.trim(), assignerName))
        .catch(err => console.error('[Slack] task reassignment notification failed:', err))

      // Google Chat notification (best-effort)
      sendGoogleChatNotification(assignedTo, formatGChatTaskAssignmentMessage(title.trim(), assignerName))
        .catch(err => console.error('[GChat] task reassignment notification failed:', err))
    }

    // Handle new file uploads
    const uploadedFiles = formData.getAll('files') as File[]
    for (const file of uploadedFiles) {
      if (file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const { url, filesize } = await uploadTaskFile(
          buffer,
          task.id,
          file.name,
          file.type || 'application/octet-stream'
        )

        await db
          .insert(kanbanTaskFiles)
          .values({
            taskId: task.id,
            filename: file.name,
            url,
            filesize,
            mimeType: file.type || 'application/octet-stream',
          })
      }
    }

    // Fetch updated files
    const files = await db
      .select()
      .from(kanbanTaskFiles)
      .where(eq(kanbanTaskFiles.taskId, taskId))

    return NextResponse.json({ ...task, files })
  } catch (error) {
    console.error('Error updating task:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

// DELETE: Delete a task and its S3 files (only task creator can delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor
  const userId = (session?.user as any)?.id

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  try {
    // Check that the current user is the task creator
    const [task] = await db
      .select({ createdBy: kanbanTasks.createdBy })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.id, taskId))

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.createdBy !== parseInt(userId)) {
      return NextResponse.json({ error: 'Only the task creator can delete this task' }, { status: 403 })
    }

    // Delete S3 files first
    const files = await db
      .select()
      .from(kanbanTaskFiles)
      .where(eq(kanbanTaskFiles.taskId, taskId))

    for (const file of files) {
      await deleteTaskFile(file.url)
    }

    // Cascade delete handles task files and notes in DB
    const [deleted] = await db
      .delete(kanbanTasks)
      .where(eq(kanbanTasks.id, taskId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
