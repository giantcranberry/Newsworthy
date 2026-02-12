import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, pitchGroups, pitchList } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, ilike } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { ContactList } from './contact-list'

async function getCompany(uuid: string, userId: number) {
  return db.query.company.findFirst({
    where: and(
      eq(company.uuid, uuid),
      eq(company.userId, userId)
    ),
  })
}

async function getGroup(companyId: number) {
  return db.query.pitchGroups.findFirst({
    where: eq(pitchGroups.coId, companyId),
  })
}

async function getContacts(groupId: number, page: number, perPage: number, query: string, status: string) {
  const offset = (page - 1) * perPage

  const baseFilter = and(
    eq(pitchList.groupId, groupId),
    sql`${pitchList.isDeleted} IS NOT TRUE`
  )

  let combinedFilter = baseFilter

  if (query) {
    combinedFilter = and(combinedFilter, ilike(pitchList.email, `%${query}%`))
  }

  if (status === 'active') {
    combinedFilter = and(combinedFilter, isNull(pitchList.bouncedAt), isNull(pitchList.unsubscribeAt))
  } else if (status === 'bounced') {
    combinedFilter = and(combinedFilter, isNotNull(pitchList.bouncedAt))
  } else if (status === 'unsubscribed') {
    combinedFilter = and(combinedFilter, isNotNull(pitchList.unsubscribeAt))
  }

  const items = await db
    .select()
    .from(pitchList)
    .where(combinedFilter)
    .orderBy(desc(pitchList.createdAt))
    .limit(perPage)
    .offset(offset)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(combinedFilter)

  // Stats are always unfiltered
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(baseFilter)

  const [bouncedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(and(baseFilter, isNotNull(pitchList.bouncedAt)))

  const [unsubRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pitchList)
    .where(and(baseFilter, isNotNull(pitchList.unsubscribeAt)))

  const total = Number(totalRow?.count || 0)
  const filtered = Number(countRow?.count || 0)
  const bounced = Number(bouncedRow?.count || 0)
  const unsubscribed = Number(unsubRow?.count || 0)
  const active = total - bounced - unsubscribed

  return {
    items,
    stats: { total, active, bounced, unsubscribed },
    filtered,
    page,
    perPage,
    totalPages: Math.ceil(filtered / perPage),
  }
}

export default async function ManageContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ page?: string; perPage?: string; q?: string; status?: string }>
}) {
  const { uuid } = await params
  const { page: pageStr, perPage: perPageStr, q, status: statusParam } = await searchParams
  const page = Math.max(1, parseInt(pageStr || '1'))
  const perPage = [10, 20, 50].includes(Number(perPageStr)) ? Number(perPageStr) : 20
  const query = q?.trim() || ''
  const status = ['active', 'bounced', 'unsubscribed'].includes(statusParam || '') ? statusParam! : ''

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const co = await getCompany(uuid, userId)
  if (!co) notFound()

  const group = await getGroup(co.id)
  if (!group) notFound()

  const data = await getContacts(group.id, page, perPage, query, status)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manage Media Contacts</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <ContactList
        companyUuid={co.uuid}
        contacts={data.items}
        stats={data.stats}
        filtered={data.filtered}
        currentPage={data.page}
        totalPages={data.totalPages}
        perPage={data.perPage}
        query={query}
        status={status}
      />
    </div>
  )
}
