import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks, kanbanTaskFiles, kanbanTaskNotes, kanbanStages, company } from '@/db/schema'
import { eq, asc, sql, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadTaskFile } from '@/services/s3'
import { verifyStageOwnership } from '@/lib/kanban-auth'

// GET: List user's tasks with files
export async function GET(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)
  const companyIdParam = request.nextUrl.searchParams.get('companyId')

  try {
    const conditions = [eq(kanbanStages.userId, uid)]
    if (companyIdParam) {
      conditions.push(eq(kanbanTasks.companyId, parseInt(companyIdParam)))
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
        companyId: kanbanTasks.companyId,
        companyName: company.companyName,
        sortOrder: kanbanTasks.sortOrder,
        createdAt: kanbanTasks.createdAt,
        updatedAt: kanbanTasks.updatedAt,
      })
      .from(kanbanTasks)
      .innerJoin(kanbanStages, eq(kanbanTasks.stageId, kanbanStages.id))
      .leftJoin(company, eq(kanbanTasks.companyId, company.id))
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

    const filesByTask = new Map<number, any[]>()
    for (const file of files) {
      const existing = filesByTask.get(file.taskId) || []
      existing.push(file)
      filesByTask.set(file.taskId, existing)
    }

    // Fetch note counts
    let noteCounts: { taskId: number; count: number }[] = []
    if (taskIds.length > 0) {
      noteCounts = await db
        .select({
          taskId: kanbanTaskNotes.taskId,
          count: sql<number>`count(*)::int`,
        })
        .from(kanbanTaskNotes)
        .where(sql`${kanbanTaskNotes.taskId} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(kanbanTaskNotes.taskId)
    }

    const noteCountMap = new Map<number, number>()
    for (const row of noteCounts) {
      noteCountMap.set(row.taskId, row.count)
    }

    const tasksWithFiles = tasks.map(task => ({
      ...task,
      assigneeFirstName: null,
      assigneeLastName: null,
      assigneeEmail: null,
      files: filesByTask.get(task.id) || [],
      noteCount: noteCountMap.get(task.id) || 0,
    }))

    return NextResponse.json(tasksWithFiles)
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

// POST: Create a new task in user's board
export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)

  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const priority = (formData.get('priority') as string) || 'medium'
    const stageId = parseInt(formData.get('stageId') as string)
    const companyIdRaw = formData.get('companyId') as string | null
    const companyId = companyIdRaw ? parseInt(companyIdRaw) : null

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (isNaN(stageId)) {
      return NextResponse.json({ error: 'Valid stage is required' }, { status: 400 })
    }

    // Verify stage belongs to user
    if (!(await verifyStageOwnership(stageId, uid))) {
      return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
    }

    const existingTasks = await db
      .select({ sortOrder: kanbanTasks.sortOrder })
      .from(kanbanTasks)
      .where(eq(kanbanTasks.stageId, stageId))
      .orderBy(asc(kanbanTasks.sortOrder))

    const maxOrder = existingTasks.length > 0
      ? Math.max(...existingTasks.map(t => t.sortOrder)) + 1
      : 0

    const [task] = await db
      .insert(kanbanTasks)
      .values({
        stageId,
        title: title.trim(),
        description,
        priority,
        assignedTo: null,
        createdBy: uid,
        companyId,
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

    return NextResponse.json({ ...task, files: fileRecords })
  } catch (error) {
    console.error('Error creating task:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
