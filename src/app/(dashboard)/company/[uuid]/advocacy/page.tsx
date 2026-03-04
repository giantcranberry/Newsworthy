import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { advocacyGroups, crmContacts } from '@/db/schema'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { randomUUID } from 'crypto'
import { CompanyNav } from '@/components/company/company-nav'
import { ShareListForm } from './advocacy-form'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

const DEFAULT_INVITE_MSG =
  'You have been added to our Share List. As a member, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

async function getOrCreateGroup(companyId: number, userId: number, companyName: string) {
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

export default async function ShareListPage({
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

  const group = await getOrCreateGroup(co.id, userId, co.companyName)
  const totalSubscribers = await getTotalSubscribers(co.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Share List</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <ShareListForm
        readOnly={isReadOnly}
        companyUuid={co.uuid}
        companyName={co.companyName}
        group={{
          id: group.id,
          inviteMsg: group.inviteMsg || DEFAULT_INVITE_MSG,
        }}
        totalSubscribers={totalSubscribers}
      />
    </div>
  )
}
