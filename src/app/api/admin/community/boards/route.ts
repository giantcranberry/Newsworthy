import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export async function GET() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const boards = await db
    .select()
    .from(communityBoards)
    .where(eq(communityBoards.isDeleted, false))
    .orderBy(asc(communityBoards.sortOrder))

  return NextResponse.json(boards)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const userId = (session?.user as any)?.id
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, slug, description, iconClass, color, rules, staffOnly } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
  }

  try {
    const [board] = await db
      .insert(communityBoards)
      .values({
        uuid: randomUUID(),
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: description || null,
        iconClass: iconClass || null,
        color: color || '#3b82f6',
        rules: rules || null,
        staffOnly: staffOnly || false,
        createdBy: userId,
      })
      .returning()

    return NextResponse.json(board)
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'A board with this slug already exists' }, { status: 409 })
    }
    throw err
  }
}
