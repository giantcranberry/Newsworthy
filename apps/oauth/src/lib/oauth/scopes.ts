import { db } from '@/db'
import { users, userProfiles, company, companyMembers } from '@nwai/db/src/schema'
import { eq } from 'drizzle-orm'

export const VALID_SCOPES = ['openid', 'profile', 'email', 'company', 'roles'] as const
export type Scope = typeof VALID_SCOPES[number]

/**
 * Validate that all requested scopes are valid and allowed for the client.
 */
export function validateScopes(requested: string[], allowed: string[]): boolean {
  return requested.every(s => VALID_SCOPES.includes(s as Scope) && allowed.includes(s))
}

/**
 * Parse a space-separated scope string into an array.
 */
export function parseScopes(scopeString: string): string[] {
  return scopeString.split(' ').filter(Boolean)
}

/**
 * Build claims for a user based on granted scopes.
 */
export async function buildClaims(userId: number, scopes: string[]): Promise<Record<string, unknown>> {
  const claims: Record<string, unknown> = {}
  const scopeSet = new Set(scopes)

  if (scopeSet.has('openid')) {
    claims.sub = userId.toString()
  }

  if (scopeSet.has('profile') || scopeSet.has('email')) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    })

    if (scopeSet.has('profile') && profile) {
      claims.name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || undefined
      claims.given_name = profile.firstName || undefined
      claims.family_name = profile.lastName || undefined
      claims.picture = profile.avatar || undefined
    }

    if (scopeSet.has('email') && user) {
      claims.email = user.email
      claims.email_verified = user.emailVerified ?? false
    }
  }

  if (scopeSet.has('roles')) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (user) {
      claims.is_admin = user.isAdmin
      claims.is_editor = user.isEditor
      claims.is_staff = user.isStaff
    }
  }

  if (scopeSet.has('company')) {
    const memberships = await db
      .select({
        companyId: company.id,
        companyUuid: company.uuid,
        companyName: company.companyName,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(company, eq(companyMembers.companyId, company.id))
      .where(eq(companyMembers.userId, userId))

    claims.companies = memberships.map(m => ({
      id: m.companyId,
      uuid: m.companyUuid,
      name: m.companyName,
      role: m.role,
    }))
  }

  return claims
}
