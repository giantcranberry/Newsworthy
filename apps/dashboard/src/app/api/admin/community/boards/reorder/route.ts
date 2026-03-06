import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { boardIds } = await request.json()
  if (!Array.isArray(boardIds)) {
    return NextResponse.json({ error: 'boardIds array required' }, { status: 400 })
  }

  for (let i = 0; i < boardIds.length; i++) {
    await db
      .update(communityBoards)
      .set({ sortOrder: i })
      .where(eq(communityBoards.id, boardIds[i]))
  }

  return NextResponse.json({ success: true })
}
