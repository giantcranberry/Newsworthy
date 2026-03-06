import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userFollows } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { followingId } = await request.json()
  if (!followingId || followingId === userId) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  try {
    await db.insert(userFollows).values({
      followerId: userId,
      followingId,
    })
    return NextResponse.json({ following: true })
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ following: true })
    }
    throw err
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { followingId } = await request.json()
  if (!followingId) {
    return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
  }

  await db
    .delete(userFollows)
    .where(
      and(
        eq(userFollows.followerId, userId),
        eq(userFollows.followingId, followingId)
      )
    )

  return NextResponse.json({ following: false })
}
