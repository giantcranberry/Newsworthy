import { auth } from '@/lib/auth'
import { db } from '@/db'
import { kanbanStages } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: List user's stages (auto-seeds defaults on first visit)
export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)

  try {
    let stages = await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.userId, uid))
      .orderBy(asc(kanbanStages.sortOrder))

    // Auto-seed default stages on first visit
    if (stages.length === 0) {
      const defaults = [
        { name: 'To Do', color: '#3b82f6', sortOrder: 0 },
        { name: 'In Progress', color: '#f59e0b', sortOrder: 1 },
        { name: 'Done', color: '#22c55e', sortOrder: 2 },
      ]

      for (const d of defaults) {
        await db.insert(kanbanStages).values({ ...d, userId: uid })
      }

      stages = await db
        .select()
        .from(kanbanStages)
        .where(eq(kanbanStages.userId, uid))
        .orderBy(asc(kanbanStages.sortOrder))
    }

    return NextResponse.json(stages)
  } catch (error) {
    console.error('Error fetching stages:', error)
    return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
  }
}

// POST: Create a new stage for the user
export async function POST(request: NextRequest) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)

  try {
    const { name, color } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const existing = await db
      .select()
      .from(kanbanStages)
      .where(eq(kanbanStages.userId, uid))
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
        userId: uid,
      })
      .returning()

    return NextResponse.json(stage)
  } catch (error) {
    console.error('Error creating stage:', error)
    return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
  }
}
