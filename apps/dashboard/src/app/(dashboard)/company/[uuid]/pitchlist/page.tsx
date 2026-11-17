import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { advocacyGroups, crmContacts } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { randomUUID } from 'crypto'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { DistributionTabs } from './distribution-tabs'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { getPrimaryContactName } from '@/lib/primary-contact'
import { getBrandMediaLists, getOrCreateDefaultMediaList } from '@/lib/media-lists'

const DEFAULT_INVITE_MSG =
  'You have been added to our Share List. As a member, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

async function getTotalPitchContacts(companyId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, companyId),
      inArray(crmContacts.contactType, ['media', 'both']),
      sql`${crmContacts.isDeleted} IS NOT TRUE`
    ))

  return Number(countRow?.count || 0)
}

async function getOrCreateAdvocacyGroup(companyId: number, userId: number, companyName: string) {
  let group = await db.query.advocacyGroups.findFirst({
    where: eq(advocacyGroups.coId, companyId),
  })

  if (!group) {
    const [newGroup] = await db.insert(advocacyGroups).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      coId: companyId,
      groupName: companyName,
      inviteMsg: DEFAULT_INVITE_MSG,
    }).returning()
    group = newGroup
  }

  return group
}

async function getTotalSubscribers(companyId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, companyId),
      inArray(crmContacts.contactType, ['advocate', 'both']),
      sql`${crmContacts.isDeleted} IS NOT TRUE`
    ))

  return Number(countRow?.count || 0)
}

export default async function PitchListPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const [_pitchGroup, advocacyGroup] = await Promise.all([
    getOrCreateDefaultMediaList(co.id, userId, co.companyName),
    getOrCreateAdvocacyGroup(co.id, userId, co.companyName),
  ])

  const [totalContacts, totalSubscribers, mediaLists] = await Promise.all([
    getTotalPitchContacts(co.id),
    getTotalSubscribers(co.id),
    getBrandMediaLists(co.id),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Distribution</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />

      <DistributionTabs
        readOnly={isReadOnly}
        companyUuid={co.uuid}
        companyName={co.companyName}
        primaryContactName={await getPrimaryContactName(co.id)}
        totalContacts={totalContacts}
        mediaLists={mediaLists.map(({ uuid, name, description, isCurated, contactCount }) => ({
          uuid, name, description, isCurated, contactCount,
        }))}
        shareGroup={{
          id: advocacyGroup.id,
          inviteMsg: advocacyGroup.inviteMsg || DEFAULT_INVITE_MSG,
        }}
        totalSubscribers={totalSubscribers}
      />
    </div>
  )
}
