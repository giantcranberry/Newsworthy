import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userFollows } from '@/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import { ProfileView } from './profile-view'

export default async function CommunityProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const currentUserId = (session?.user as any)?.id
  if (!currentUserId) redirect('/login')

  const { id } = await params
  const profileUserId = parseInt(id)
  if (isNaN(profileUserId)) notFound()

  // Get user profile
  const [profile] = await db
    .select({
      id: users.id,
      name: sql<string>`COALESCE(NULLIF(${userProfiles.acctName}, ''), CONCAT(${userProfiles.firstName}, ' ', LEFT(${userProfiles.lastName}, 1), '.'), 'Anonymous')`.as('name'),
      avatar: userProfiles.avatar,
      emailHash: sql<string>`MD5(LOWER(TRIM(${users.email})))`.as('emailHash'),
      bio: userProfiles.bio,
      acctHandle: userProfiles.acctHandle,
      company: userProfiles.company,
      location: sql<string>`NULLIF(CONCAT_WS(', ', NULLIF(${userProfiles.city}, ''), NULLIF(COALESCE(NULLIF(${userProfiles.state}, ''), NULLIF(${userProfiles.province}, '')), '')), '')`.as('location'),
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(eq(users.id, profileUserId))
    .limit(1)

  if (!profile) notFound()

  // Get follower/following counts
  const [followerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userFollows)
    .where(eq(userFollows.followingId, profileUserId))

  const [followingCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(userFollows)
    .where(eq(userFollows.followerId, profileUserId))

  // Check if current user follows this user
  const [isFollowing] = await db
    .select({ id: userFollows.id })
    .from(userFollows)
    .where(
      and(
        eq(userFollows.followerId, currentUserId),
        eq(userFollows.followingId, profileUserId)
      )
    )
    .limit(1)

  return (
    <ProfileView
      profile={{
        ...profile,
        followerCount: Number(followerCount?.count || 0),
        followingCount: Number(followingCount?.count || 0),
      }}
      currentUserId={currentUserId}
      isFollowing={!!isFollowing}
      isAdmin={(session?.user as any)?.isAdmin}
    />
  )
}
