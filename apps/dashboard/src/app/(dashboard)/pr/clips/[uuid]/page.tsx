import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
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
    if (!companyIds.includes(release.companyId)) redirect('/pr/reports')
  }

  return <ClipsReport uuid={uuid} isPublic={false} />
}
