import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTaskFiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { deleteTaskFile } from '@/services/s3'

// DELETE: Delete a single file from a task
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, fileId } = await params
  const taskId = parseInt(id)
  const fId = parseInt(fileId)

  if (isNaN(taskId) || isNaN(fId)) {
    return NextResponse.json({ error: 'Invalid IDs' }, { status: 400 })
  }

  try {
    const [file] = await db
      .select()
      .from(kanbanTaskFiles)
      .where(and(eq(kanbanTaskFiles.id, fId), eq(kanbanTaskFiles.taskId, taskId)))

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete from S3
    await deleteTaskFile(file.url)

    // Delete from DB
    await db
      .delete(kanbanTaskFiles)
      .where(eq(kanbanTaskFiles.id, fId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
