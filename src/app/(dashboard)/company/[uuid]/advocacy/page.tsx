import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, advocacyGroups, advocates } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { randomUUID } from 'crypto'
import { CompanyNav } from '@/components/company/company-nav'
import { ShareListForm } from './advocacy-form'

const DEFAULT_INVITE_MSG =
  'You have been added to our Share List. As a member, you will be notified via email when we distribute a new press release — with an invitation to share the news with your social networks.'

async function getCompany(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

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

async function getTotalSubscribers(groupId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(advocates)
    .where(and(
      eq(advocates.groupId, groupId),
      sql`${advocates.isDeleted} IS NOT TRUE`
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

  const co = await getCompany(uuid, userId, isAdmin)
  if (!co) notFound()

  const group = await getOrCreateGroup(co.id, userId, co.companyName)
  const totalSubscribers = await getTotalSubscribers(group.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Share List</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <ShareListForm
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
