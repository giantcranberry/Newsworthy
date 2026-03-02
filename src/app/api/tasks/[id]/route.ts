import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTasks, kanbanTaskFiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { uploadTaskFile, deleteTaskFile } from '@/services/s3'
import { verifyTaskOwnership, verifyStageOwnership } from '@/lib/kanban-auth'

// GET: Single task with files
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  const uid = parseInt(userId)
  if (!(await verifyTaskOwnership(taskId, uid))) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  try {
    const [task] = await db
      .select()
      .from(kanbanTasks)
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
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  const uid = parseInt(userId)
  if (!(await verifyTaskOwnership(taskId, uid))) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  try {
    const formData = await request.formData()
    const title = formData.get('title') as string
    const description = (formData.get('description') as string) || null
    const priority = formData.get('priority') as string | null
    const stageId = formData.get('stageId') ? parseInt(formData.get('stageId') as string) : undefined
    const companyIdRaw = formData.get('companyId') as string | null
    const companyId = companyIdRaw !== null ? (companyIdRaw ? parseInt(companyIdRaw) : null) : undefined

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Verify target stage belongs to user if changing stages
    if (stageId !== undefined) {
      if (!(await verifyStageOwnership(stageId, uid))) {
        return NextResponse.json({ error: 'Invalid stage' }, { status: 400 })
      }
    }

    const updates: Record<string, any> = {
      title: title.trim(),
      description,
      updatedAt: sql`NOW()`,
    }

    if (priority) updates.priority = priority
    if (stageId !== undefined) updates.stageId = stageId
    if (companyId !== undefined) updates.companyId = companyId

    const [task] = await db
      .update(kanbanTasks)
      .set(updates)
      .where(eq(kanbanTasks.id, taskId))
      .returning()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
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

// DELETE: Delete a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const taskId = parseInt(id)
  if (isNaN(taskId)) {
    return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
  }

  const uid = parseInt(userId)
  if (!(await verifyTaskOwnership(taskId, uid))) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }

  try {
    // Delete S3 files first
    const files = await db
      .select()
      .from(kanbanTaskFiles)
      .where(eq(kanbanTaskFiles.taskId, taskId))

    for (const file of files) {
      await deleteTaskFile(file.url)
    }

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
