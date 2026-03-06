import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

export type TeamRole = 'owner' | 'brand_admin' | 'collaborator' | 'client'

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  brand_admin: 3,
  collaborator: 2,
  client: 1,
}

export function hasMinRole(userRole: TeamRole, requiredRole: TeamRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export async function getCompanyAccess(
  companyUuid: string,
  userId: number,
  isAdmin: boolean
): Promise<{ company: typeof company.$inferSelect; role: TeamRole } | null> {
  // Platform admins get owner-level access to any company
  if (isAdmin) {
    const co = await db.query.company.findFirst({
      where: eq(company.uuid, companyUuid),
    })
    if (!co) return null
    return { company: co, role: 'owner' }
  }

  // Check if user is the company owner
  const co = await db.query.company.findFirst({
    where: eq(company.uuid, companyUuid),
  })
  if (!co) return null

  if (co.userId === userId) {
    return { company: co, role: 'owner' }
  }

  // Check company_members table
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, co.id),
      eq(companyMembers.userId, userId)
    ),
  })

  if (membership) {
    return { company: co, role: membership.role as TeamRole }
  }

  return null
}

/**
 * Get all company IDs a user has access to (owned + team memberships).
 * Optionally filter by minimum role (e.g. 'collaborator' excludes 'client').
 */
export async function getUserCompanyIds(userId: number, minRole?: TeamRole): Promise<number[]> {
  const owned = await db
    .select({ id: company.id })
    .from(company)
    .where(and(
      eq(company.userId, userId),
      eq(company.isDeleted, false),
      eq(company.isArchived, false),
    ))

  const memberships = await db
    .select({ companyId: companyMembers.companyId, role: companyMembers.role })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const idSet = new Set<number>()
  // Owners always pass any minRole check
  for (const row of owned) idSet.add(row.id)
  for (const row of memberships) {
    if (minRole && !hasMinRole(row.role as TeamRole, minRole)) continue
    idSet.add(row.companyId)
  }

  return Array.from(idSet)
}
