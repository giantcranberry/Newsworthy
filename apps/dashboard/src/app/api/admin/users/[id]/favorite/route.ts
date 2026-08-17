import { auth } from '@/lib/auth'
import { db } from '@/db'
import { adminUserFavorites, users } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const adminUserId = session?.user?.id ? Number(session.user.id) : NaN

  if (!isAdmin || !Number.isFinite(adminUserId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const favoritedUserId = Number(id)
  if (!Number.isFinite(favoritedUserId)) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  if (favoritedUserId === adminUserId) {
    return NextResponse.json({ error: 'Cannot favorite yourself' }, { status: 400 })
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, favoritedUserId), eq(users.isDeleted, false)))
    .limit(1)

  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const [existing] = await db
    .select({ id: adminUserFavorites.id })
    .from(adminUserFavorites)
    .where(
      and(
        eq(adminUserFavorites.adminUserId, adminUserId),
        eq(adminUserFavorites.favoritedUserId, favoritedUserId)
      )
    )
    .limit(1)

  if (existing) {
    await db.delete(adminUserFavorites).where(eq(adminUserFavorites.id, existing.id))
    return NextResponse.json({ favorited: false })
  }

  await db.insert(adminUserFavorites).values({
    adminUserId,
    favoritedUserId,
  })

  return NextResponse.json({ favorited: true })
}
