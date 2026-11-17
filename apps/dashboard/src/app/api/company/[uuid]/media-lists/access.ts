import { getEffectiveSession } from '@/lib/auth'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { NextResponse } from 'next/server'

type Access = NonNullable<Awaited<ReturnType<typeof getCompanyAccess>>>

/**
 * Resolve the caller's access to a brand for media-list routes.
 * Writes require brand_admin, matching the Distribution page's read-only rule.
 */
export async function mediaListAccess(
  companyUuid: string,
  { write }: { write: boolean },
): Promise<{ ok: true; userId: number; access: Access } | { ok: false; response: NextResponse }> {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = parseInt(session.user.id)
  const isAdmin = !!(session.user as any)?.isAdmin || !!(session.user as any)?.isStaff
  const access = await getCompanyAccess(companyUuid, userId, isAdmin)
  if (!access) {
    return { ok: false, response: NextResponse.json({ error: 'Company not found' }, { status: 404 }) }
  }
  if (write && !hasMinRole(access.role, 'brand_admin')) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { ok: true, userId, access }
}

export const curatedReadOnly = () =>
  NextResponse.json({ error: 'The Newsworthy Curated list is managed by Newsworthy and cannot be changed' }, { status: 403 })
