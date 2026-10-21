import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { crmContacts, tinyUrl, tinyUrlClicks } from '@/db/schema'
import { eq, and, asc, desc, sql, getTableColumns, isNotNull, isNull, ilike, or, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { AdvocateList } from './advocate-list'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

async function getAdvocates(companyId: number, page: number, perPage: number, query: string, status: string, sort: string) {
  const offset = (page - 1) * perPage

  const baseFilter = and(
    eq(crmContacts.companyId, companyId),
    inArray(crmContacts.contactType, ['advocate', 'both']),
    sql`${crmContacts.isDeleted} IS NOT TRUE`
  )

  let combinedFilter = baseFilter

  if (query) {
    combinedFilter = and(combinedFilter, or(
      ilike(crmContacts.email, `%${query}%`),
      ilike(crmContacts.firstName, `%${query}%`),
      ilike(crmContacts.lastName, `%${query}%`)
    ))
  }

  if (status === 'active') {
    combinedFilter = and(combinedFilter, isNull(crmContacts.bouncedAt), isNull(crmContacts.unsubscribeAt))
  } else if (status === 'bounced') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.bouncedAt))
  } else if (status === 'unsubscribed') {
    combinedFilter = and(combinedFilter, isNotNull(crmContacts.unsubscribeAt))
  }

  // Share-link clicks: each advocacy send creates a tiny_url per contact with
  // advocat_id = crm_contacts.id; pre-migration rows used the legacy advocates.id
  // (kept on the contact as source_id). Outer columns are written out qualified:
  // drizzle renders select-list columns unqualified, so "id" would bind to tiny_url.id.
  const clicks = sql<number>`(
    SELECT coalesce(sum(t.hits), 0) FROM ${tinyUrl} t
    WHERE t.co_id = ${companyId}
      AND (t.advocat_id = "crm_contacts"."id"
        OR ("crm_contacts"."source_table" = 'advocates' AND t.advocat_id = "crm_contacts"."source_id"))
  )`.mapWith(Number)

  // Distinct visitors (IP + device) across those links, from the per-click log
  const uniqueVisitors = sql<number>`(
    SELECT count(DISTINCT c.visitor_hash) FROM ${tinyUrlClicks} c
    JOIN ${tinyUrl} t ON t.id = c.tiny_url_id
    WHERE t.co_id = ${companyId}
      AND (t.advocat_id = "crm_contacts"."id"
        OR ("crm_contacts"."source_table" = 'advocates' AND t.advocat_id = "crm_contacts"."source_id"))
  )`.mapWith(Number)

  const orderBy = sort === 'clicks_asc'
    ? [asc(clicks), desc(crmContacts.createdAt)]
    : [desc(clicks), desc(crmContacts.createdAt)]

  const items = await db
    .select({ ...getTableColumns(crmContacts), clicks, uniqueVisitors })
    .from(crmContacts)
    .where(combinedFilter)
    .orderBy(...orderBy)
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

export default async function ManageAdvocatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ page?: string; perPage?: string; q?: string; status?: string; sort?: string }>
}) {
  const { uuid } = await params
  const { page: pageStr, perPage: perPageStr, q, status: statusParam, sort: sortParam } = await searchParams
  const page = Math.max(1, parseInt(pageStr || '1'))
  const perPage = [10, 20, 50].includes(Number(perPageStr)) ? Number(perPageStr) : 20
  const query = q?.trim() || ''
  const status = ['active', 'bounced', 'unsubscribed'].includes(statusParam || '') ? statusParam! : ''
  const sort = sortParam === 'clicks_asc' ? 'clicks_asc' : 'clicks_desc'

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const data = await getAdvocates(co.id, page, perPage, query, status, sort)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Subscribers</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />

      <AdvocateList
        readOnly={isReadOnly}
        companyUuid={co.uuid}
        advocates={data.items}
        stats={data.stats}
        filtered={data.filtered}
        currentPage={data.page}
        totalPages={data.totalPages}
        perPage={data.perPage}
        query={query}
        status={status}
        sort={sort}
      />
    </div>
  )
}
