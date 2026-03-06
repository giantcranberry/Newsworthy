import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanTaskNotes, users, userProfiles } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: List notes for a task
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
    const notes = await db
      .select({
        id: kanbanTaskNotes.id,
        taskId: kanbanTaskNotes.taskId,
        content: kanbanTaskNotes.content,
        createdBy: kanbanTaskNotes.createdBy,
        createdAt: kanbanTaskNotes.createdAt,
        authorFirstName: userProfiles.firstName,
        authorLastName: userProfiles.lastName,
        authorEmail: users.email,
      })
      .from(kanbanTaskNotes)
      .leftJoin(users, eq(kanbanTaskNotes.createdBy, users.id))
      .leftJoin(userProfiles, eq(kanbanTaskNotes.createdBy, userProfiles.userId))
      .where(eq(kanbanTaskNotes.taskId, taskId))
      .orderBy(asc(kanbanTaskNotes.createdAt))

    return NextResponse.json(notes)
  } catch (error) {
    console.error('Error fetching notes:', error)
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

// POST: Add a note to a task
export async function POST(
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
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const [note] = await db
      .insert(kanbanTaskNotes)
      .values({
        taskId,
        content: content.trim(),
        createdBy: parseInt(userId),
      })
      .returning()

    return NextResponse.json(note)
  } catch (error) {
    console.error('Error creating note:', error)
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
