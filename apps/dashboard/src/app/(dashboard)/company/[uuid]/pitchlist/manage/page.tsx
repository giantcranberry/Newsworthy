import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { crmContacts } from '@/db/schema'
import { eq, and, desc, sql, isNotNull, isNull, ilike, or, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandSetupStatus } from '@/lib/brand-setup'
import { ContactList } from './contact-list'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

async function getContacts(companyId: number, page: number, perPage: number, query: string, status: string) {
  const offset = (page - 1) * perPage

  const baseFilter = and(
    eq(crmContacts.companyId, companyId),
    inArray(crmContacts.contactType, ['media', 'both']),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  let combinedFilter = baseFilter

  if (query) {
    combinedFilter = and(combinedFilter, or(
      ilike(crmContacts.email, `%${query}%`),
      ilike(crmContacts.firstName, `%${query}%`),
      ilike(crmContacts.lastName, `%${query}%`),
      ilike(crmContacts.publication, `%${query}%`)
    ))
  }

  if (status === 'active') {
    combinedFilter = and(combinedFilter, isNull(crmContacts.bouncedAt), isNull(crmContacts.unsubscribeAt))
  } else if (status === 'bounced') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.bouncedAt))
  } else if (status === 'unsubscribed') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.unsubscribeAt))
  }

  const items = await db
    .select()
    .from(crmContacts)
    .where(combinedFilter)
    .orderBy(desc(crmContacts.createdAt))
    .limit(perPage)
    .offset(offset)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(combinedFilter)

  // Stats are always unfiltered
  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(baseFilter)

  const [bouncedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, isNotNull(crmContacts.bouncedAt)))

  const [unsubRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(baseFilter, isNotNull(crmContacts.unsubscribeAt)))

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
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const data = await getContacts(co.id, page, perPage, query, status)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Media Contacts</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} setupMode={!(await getBrandSetupStatus(co)).complete} />

      <ContactList
        readOnly={isReadOnly}
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
