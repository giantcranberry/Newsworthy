import { auth } from '@/lib/auth'
import { db } from '@/db'
import { staffNotes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const noteId = parseInt(id, 10)

  if (isNaN(noteId)) {
    return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 })
  }

  const { body } = await request.json()

  if (!body || body.trim().length < 10) {
    return NextResponse.json({ error: 'Note must be at least 10 characters' }, { status: 400 })
  }

  await db
    .update(staffNotes)
    .set({ body: body.trim() })
    .where(eq(staffNotes.id, noteId))

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { id } = await params
  const noteId = parseInt(id, 10)

  if (isNaN(noteId)) {
    return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 })
  }

  await db.delete(staffNotes).where(eq(staffNotes.id, noteId))

  return NextResponse.json({ success: true })
}
