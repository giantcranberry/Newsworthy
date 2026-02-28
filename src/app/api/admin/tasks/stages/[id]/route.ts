import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanStages } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// PUT: Update a stage (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const stageId = parseInt(id)
  if (isNaN(stageId)) {
    return NextResponse.json({ error: 'Invalid stage ID' }, { status: 400 })
  }

  try {
    const { name, color } = await request.json()

    const updates: Record<string, any> = {}
    if (name?.trim()) updates.name = name.trim()
    if (color) updates.color = color

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const [stage] = await db
      .update(kanbanStages)
      .set(updates)
      .where(eq(kanbanStages.id, stageId))
      .returning()

    if (!stage) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error updating stage:', error)
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 })
  }
}

// DELETE: Delete a stage (admin only, cascades tasks)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const stageId = parseInt(id)
  if (isNaN(stageId)) {
    return NextResponse.json({ error: 'Invalid stage ID' }, { status: 400 })
  }

  try {
    const [deleted] = await db
      .delete(kanbanStages)
      .where(eq(kanbanStages.id, stageId))
      .returning()

    if (!deleted) {
      return NextResponse.json({ error: 'Stage not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting stage:', error)
    return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 })
  }
}
