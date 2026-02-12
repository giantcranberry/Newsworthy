import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, pitchGroups, pitchList } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { randomUUID } from 'crypto'
import { CompanyNav } from '@/components/company/company-nav'
import { PitchListForm } from './pitchlist-form'

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
  let group = await db.query.pitchGroups.findFirst({
    where: eq(pitchGroups.coId, companyId),
  })

  if (!group) {
    const [newGroup] = await db.insert(pitchGroups).values({
      uuid: randomUUID().replace(/-/g, ''),
      userId,
      coId: companyId,
      groupName: companyName,
    }).returning()
    group = newGroup
  }

  return group
}

async function getTotalContacts(groupId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(and(
      eq(pitchList.groupId, groupId),
      sql`${pitchList.isDeleted} IS NOT TRUE`
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

  const co = await getCompany(uuid, userId, isAdmin)
  if (!co) notFound()

  const group = await getOrCreateGroup(co.id, userId, co.companyName)
  const totalContacts = await getTotalContacts(group.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Pitch List</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <PitchListForm
        companyUuid={co.uuid}
        companyName={co.companyName}
        totalContacts={totalContacts}
      />
    </div>
  )
}
