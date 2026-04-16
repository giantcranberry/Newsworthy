import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { redirect } from 'next/navigation'
import { ClipsReport } from './clips-report'

export default async function ClipsPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) redirect('/login')

  // Verify access
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })

  if (!release || release.status !== 'sent') redirect('/pr/reports')

  const isAdminOrImpersonating = (session?.user as any)?.isAdmin || (session?.user as any)?.isImpersonating
  if (!isAdminOrImpersonating && release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      // Allow partner managers to view reports for users in their managed partnerships
      const managedPartnerIds = ((session?.user as any)?.managedPartnerIds as number[] | undefined) || []
      let allowed = false
      if (managedPartnerIds.length > 0) {
        const owner = await db.query.users.findFirst({
          where: eq(users.id, release.userId),
          columns: { partnerId: true },
        })
        if (owner?.partnerId && managedPartnerIds.includes(owner.partnerId)) {
          allowed = true
        }
      }
      if (!allowed) redirect('/pr/reports')
    }
  }

  return <ClipsReport uuid={uuid} isPublic={false} />
}
