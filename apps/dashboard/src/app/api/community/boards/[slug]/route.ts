import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { slug } = await params

  const [board] = await db
    .select()
    .from(communityBoards)
    .where(
      and(
        eq(communityBoards.slug, slug),
        eq(communityBoards.isDeleted, false)
      )
    )
    .limit(1)

  if (!board) {
    return NextResponse.json({ error: 'Board not found' }, { status: 404 })
  }

  return NextResponse.json(board)
}
