import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userFollows, users, userProfiles } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth()
  const currentUserId = (session?.user as any)?.id
  if (!currentUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId')
    ? parseInt(searchParams.get('userId')!)
    : currentUserId

  const followers = await db
    .select({
      id: users.id,
      name: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('name'),
      avatar: userProfiles.avatar,
      emailHash: sql<string>`MD5(LOWER(TRIM(${users.email})))`.as('emailHash'),
      acctHandle: userProfiles.acctHandle,
      location: sql<string>`NULLIF(CONCAT_WS(', ', NULLIF(${userProfiles.city}, ''), NULLIF(COALESCE(NULLIF(${userProfiles.state}, ''), NULLIF(${userProfiles.province}, '')), '')), '')`.as('location'),
      followedAt: userFollows.createdAt,
    })
    .from(userFollows)
    .innerJoin(users, eq(userFollows.followerId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(userFollows.followingId, targetUserId))

  return NextResponse.json(followers)
}
