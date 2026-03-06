import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanStages } from '@/db/schema'
import { asc, isNull } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: List all global (admin) stages ordered by sortOrder
export async function GET() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor

  if (!isAdmin && !isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stages = await db
    .select()
    .from(kanbanStages)
    .where(isNull(kanbanStages.userId))
    .orderBy(asc(kanbanStages.sortOrder))

  return NextResponse.json(stages)
}

// POST: Create a new global stage (admin only)
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, color } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Get max sort order for global stages
    const existing = await db
      .select()
      .from(kanbanStages)
      .where(isNull(kanbanStages.userId))
      .orderBy(asc(kanbanStages.sortOrder))

    const maxOrder = existing.length > 0
      ? Math.max(...existing.map(s => s.sortOrder)) + 1
      : 0

    const [stage] = await db
      .insert(kanbanStages)
      .values({
        name: name.trim(),
        color: color || '#3b82f6',
        sortOrder: maxOrder,
      })
      .returning()

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error creating stage:', error)
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
  }
}
