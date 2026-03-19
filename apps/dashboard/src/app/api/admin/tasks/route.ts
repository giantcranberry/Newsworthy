import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks, kanbanTaskFiles, kanbanTaskNotes, kanbanStages, users, userProfiles } from '@/db/schema'
import { eq, asc, sql, and, isNull, or } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadTaskFile } from '@/services/s3'
import { sendSystemMessageWithEmail } from '@/lib/messages'
import { sendSlackNotification, formatTaskAssignmentMessage } from '@/lib/slack'
import { sendGoogleChatNotification, formatGChatTaskAssignmentMessage } from '@/lib/google-chat'

// GET: List all global (admin) tasks with files
export async function GET(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const assignedTo = request.nextUrl.searchParams.get('assignedTo')

  try {
    const conditions = [
      isNull(kanbanStages.userId),
      or(eq(kanbanTasks.isArchived, false), isNull(kanbanTasks.isArchived)),
    ]
    if (assignedTo) {
      conditions.push(eq(kanbanTasks.assignedTo, parseInt(assignedTo)))
    }

    const tasks = await db
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
      .innerJoin(kanbanStages, eq(kanbanTasks.stageId, kanbanStages.id))
      .leftJoin(users, eq(kanbanTasks.assignedTo, users.id))
      .leftJoin(userProfiles, eq(kanbanTasks.assignedTo, userProfiles.userId))
      .where(and(...conditions))
      .orderBy(asc(kanbanTasks.sortOrder))

    // Fetch files for all tasks
    const taskIds = tasks.map(t => t.id)
    let files: any[] = []
    if (taskIds.length > 0) {
      files = await db
        .select()
        .from(kanbanTaskFiles)
        .where(sql`${kanbanTaskFiles.taskId} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
    }

    // Group files by task
    const filesByTask = new Map<number, any[]>()
    for (const file of files) {
      const existing = filesByTask.get(file.taskId) || []
      existing.push(file)
      filesByTask.set(file.taskId, existing)
    }

    // Fetch note counts for all tasks
    let noteCounts: { taskId: number; count: number }[] = []
    if (taskIds.length > 0) {
      const noteCountRows = await db
        .select({
          taskId: kanbanTaskNotes.taskId,
          count: sql<number>`count(*)::int`,
        })
        .from(kanbanTaskNotes)
        .where(sql`${kanbanTaskNotes.taskId} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(kanbanTaskNotes.taskId)

      noteCounts = noteCountRows
    }

    const noteCountMap = new Map<number, number>()
    for (const row of noteCounts) {
      noteCountMap.set(row.taskId, row.count)
    }

    // Fetch creator names
    const creatorIds = [...new Set(tasks.map(t => t.createdBy).filter(Boolean))]
    const creatorMap = new Map<number, { firstName: string | null; lastName: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const creators = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: userProfiles.firstName,
          lastName: userProfiles.lastName,
        })
        .from(users)
        .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
        .where(sql`${users.id} IN (${sql.join(creatorIds.map(id => sql`${id}`), sql`, `)})`)

      for (const c of creators) {
        creatorMap.set(c.id, { firstName: c.firstName, lastName: c.lastName, email: c.email })
      }
    }

    const tasksWithFiles = tasks.map(task => {
      const creator = creatorMap.get(task.createdBy)
      return {
        ...task,
        files: filesByTask.get(task.id) || [],
        noteCount: noteCountMap.get(task.id) || 0,
        creatorFirstName: creator?.firstName || null,
        creatorLastName: creator?.lastName || null,
        creatorEmail: creator?.email || null,
      }
    })

    return NextResponse.json(tasksWithFiles)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST: Create a new task (with optional file uploads)
export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor
  const userId = (session?.user as any)?.id

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const priority = (formData.get('priority') as string) || 'medium'
    const stageId = parseInt(formData.get('stageId') as string)
    const assignedTo = formData.get('assignedTo') ? parseInt(formData.get('assignedTo') as string) : null

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (isNaN(stageId)) {
      return NextResponse.json({ error: 'Valid stage is required' }, { status: 400 })
    }

    // Get max sort order for the stage
    const existingTasks = await db
      .select({ sortOrder: kanbanTasks.sortOrder })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.stageId, stageId))
      .orderBy(asc(kanbanTasks.sortOrder))

    const maxOrder = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.sortOrder)) + 1
      : 0

    const now = new Date().toISOString()

    const [task] = await db
      .insert(kanbanTasks)
      .values({
        stageId,
        title: title.trim(),
        description,
        priority,
        assignedTo,
        createdBy: parseInt(userId),
        sortOrder: maxOrder,
        createdAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      })
      .returning()

    // Handle file uploads
    const uploadedFiles = formData.getAll('files') as File[]
    const fileRecords = []

    for (const file of uploadedFiles) {
      if (file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const { url, filesize } = await uploadTaskFile(
          buffer,
          task.id,
          file.name,
          file.type || 'application/octet-stream'
        )

        const [fileRecord] = await db
          .insert(kanbanTaskFiles)
          .values({
            taskId: task.id,
            filename: file.name,
            url,
            filesize,
            mimeType: file.type || 'application/octet-stream',
          })
          .returning()

        fileRecords.push(fileRecord)
      }
    }

    // Notify assignee if assigned to someone other than the creator
    if (assignedTo && assignedTo !== parseInt(userId)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthy.ai'
      sendSystemMessageWithEmail(
        assignedTo,
        'Task Assigned: ' + title.trim(),
        `<p>You have been assigned a new task: <strong>${title.trim()}</strong></p>`,
        { taskId: task.id }
      ).catch(err => console.error('Failed to send task assignment notification:', err))

      // Slack notification (best-effort)
      const assignerProfile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, parseInt(userId)),
      })
      const assignerName = assignerProfile?.firstName || 'Someone'
      sendSlackNotification(assignedTo, formatTaskAssignmentMessage(title.trim(), assignerName))
        .catch(err => console.error('[Slack] task assignment notification failed:', err))

      // Google Chat notification (best-effort)
      sendGoogleChatNotification(assignedTo, formatGChatTaskAssignmentMessage(title.trim(), assignerName))
        .catch(err => console.error('[GChat] task assignment notification failed:', err))
    }

    return NextResponse.json({ ...task, files: fileRecords })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
