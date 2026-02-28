import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles } from '@/db/schema'
import { sql, eq, or, and } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: Search users by email for compose dialog
// Supports ?role=editorial to return only admins/editors
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin && !(session?.user as any)?.isEditor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = request.nextUrl.searchParams.get('role')

  // For editorial role filter, return all admins/editors without requiring search query
  if (role === 'editorial') {
    const results = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: userProfiles.firstName,
        lastName: userProfiles.lastName,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(and(
        or(eq(users.isAdmin, true), eq(users.isEditor, true)),
        eq(users.isDeleted, false)
      ))
      .limit(50)

    return NextResponse.json(results)
  }

  const q = request.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const results = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(sql`LOWER(${users.email}) LIKE ${`%${q.toLowerCase()}%`}`)
    .limit(10)

  return NextResponse.json(results)
}
