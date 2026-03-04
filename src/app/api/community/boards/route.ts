import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const boards = await db
    .select()
    .from(communityBoards)
    .where(and(eq(communityBoards.isDeleted, false), eq(communityBoards.isArchived, false)))
    .orderBy(asc(communityBoards.sortOrder))

  return NextResponse.json(boards)
}
