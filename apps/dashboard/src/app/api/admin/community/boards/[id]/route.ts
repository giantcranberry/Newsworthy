import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const boardId = parseInt(id)
  if (isNaN(boardId)) {
    return NextResponse.json({ error: 'Invalid board ID' }, { status: 400 })
  }

  const body = await request.json()
  const { name, slug, description, iconClass, color, rules, staffOnly, isArchived } = body

  const updates: Record<string, any> = { updatedAt: new Date() }
  if (name !== undefined) updates.name = name
  if (slug !== undefined) updates.slug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
  if (description !== undefined) updates.description = description
  if (iconClass !== undefined) updates.iconClass = iconClass
  if (color !== undefined) updates.color = color
  if (rules !== undefined) updates.rules = rules
  if (staffOnly !== undefined) updates.staffOnly = staffOnly
  if (isArchived !== undefined) updates.isArchived = isArchived

  try {
    const [board] = await db
      .update(communityBoards)
      .set(updates)
      .where(eq(communityBoards.id, boardId))
      .returning()

    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 })
    }

    return NextResponse.json(board)
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A board with this slug already exists' }, { status: 409 })
    }
    throw err
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const boardId = parseInt(id)
  if (isNaN(boardId)) {
    return NextResponse.json({ error: 'Invalid board ID' }, { status: 400 })
  }

  const [board] = await db
    .update(communityBoards)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(communityBoards.id, boardId))
    .returning()

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
