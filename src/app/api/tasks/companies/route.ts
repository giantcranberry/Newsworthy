import { auth } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'

// GET: Return current user's companies (owned + team member) for brand selector
export async function GET() {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = parseInt(userId)

  try {
    // Get companies owned by the user
    const owned = await db
      .select({ id: company.id, uuid: company.uuid, companyName: company.companyName })
      .from(company)
      .where(
        and(
          eq(company.userId, uid),
          eq(company.isDeleted, false),
          eq(company.isArchived, false),
        )
      )

    // Get companies where user is a team member
    const memberships = await db
      .select({ id: company.id, uuid: company.uuid, companyName: company.companyName })
      .from(companyMembers)
      .innerJoin(company, eq(companyMembers.companyId, company.id))
      .where(
        and(
          eq(companyMembers.userId, uid),
          eq(company.isDeleted, false),
          eq(company.isArchived, false),
        )
      )

    // Deduplicate
    const seen = new Set<number>()
    const result: { id: number; uuid: string | null; companyName: string }[] = []
    for (const c of [...owned, ...memberships]) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        result.push(c)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching user companies:', error)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}
