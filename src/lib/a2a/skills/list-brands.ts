import { db } from '@/db'
import { company, companyMembers, releases } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import type { Message, SkillResult, AuthContext } from '../types'

export async function listBrands(message: Message, auth: AuthContext): Promise<SkillResult> {
  const companyIds = await getUserCompanyIds(auth.userId)

  if (companyIds.length === 0) {
    return {
      artifacts: [{
        id: 'brand-list',
        name: 'My Brands',
        parts: [
          { type: 'text', text: 'No brands found for this account.' },
          { type: 'data', mimeType: 'application/json', data: { results: [] } },
        ],
      }],
    }
  }

  // Fetch all accessible companies
  const companies = await db
    .select({
      id: company.id,
      uuid: company.uuid,
      companyName: company.companyName,
      nrUri: company.nrUri,
      userId: company.userId,
    })
    .from(company)
    .where(
      and(
        sql`${company.id} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})`,
        eq(company.isDeleted, false),
        eq(company.isArchived, false),
      )
    )

  // Determine role and published release count for each
  const results = await Promise.all(
    companies.map(async (co) => {
      let role = 'owner'
      if (co.userId !== auth.userId) {
        const membership = await db.query.companyMembers.findFirst({
          where: and(
            eq(companyMembers.companyId, co.id),
            eq(companyMembers.userId, auth.userId)
          ),
        })
        role = membership?.role || 'member'
      }

      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(releases)
        .where(
          and(
            eq(releases.companyId, co.id),
            eq(releases.status, 'sent'),
            eq(releases.isDeleted, false),
          )
        )

      return {
        uuid: co.uuid,
        name: co.companyName,
        role,
        newsroomUri: co.nrUri,
        publishedReleaseCount: Number(countResult?.count || 0),
      }
    })
  )

  return {
    artifacts: [{
      id: 'brand-list',
      name: 'My Brands',
      parts: [
        { type: 'text', text: `Found ${results.length} brand${results.length !== 1 ? 's' : ''} for this account.` },
        { type: 'data', mimeType: 'application/json', data: { results } },
      ],
    }],
  }
}
