import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const owned = await db
      .select({ id: company.id, companyName: company.companyName })
      .from(company)
      .where(
        and(
          eq(company.userId, userId),
          eq(company.isDeleted, false),
          eq(company.isArchived, false),
        )
      )

    const memberships = await db
      .select({ id: company.id, companyName: company.companyName })
      .from(companyMembers)
      .innerJoin(company, eq(companyMembers.companyId, company.id))
      .where(
        and(
          eq(companyMembers.userId, userId),
          eq(company.isDeleted, false),
          eq(company.isArchived, false),
        )
      )

    const seen = new Set<number>()
    const result: { id: number; companyName: string }[] = []
    for (const c of [...owned, ...memberships]) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        result.push(c)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Calendar] Error fetching companies:', error)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }
}
