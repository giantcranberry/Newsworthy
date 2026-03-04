import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, crmContacts, companyMembers } from '@/db/schema'
import { eq, and, desc, sql, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Users, Newspaper, Heart } from 'lucide-react'

async function getUserCompanies(userId: number) {
  const owned = await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false),
      eq(company.isArchived, false),
    ),
    orderBy: desc(company.id),
  })

  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const ownedIds = new Set(owned.map((c) => c.id))
  const sharedIds = memberships
    .map((m) => m.companyId)
    .filter((id) => !ownedIds.has(id))

  let shared: typeof owned = []
  if (sharedIds.length > 0) {
    shared = await db.query.company.findMany({
      where: and(
        inArray(company.id, sharedIds),
        eq(company.isDeleted, false),
        eq(company.isArchived, false),
      ),
      orderBy: desc(company.id),
    })
  }

  return [...owned, ...shared]
}

async function getContactStats(companyIds: number[]) {
  if (companyIds.length === 0) return new Map<number, { total: number; media: number; advocates: number }>()

  const stats = await db
    .select({
      companyId: crmContacts.companyId,
      total: sql<number>`count(*)`,
      media: sql<number>`count(*) FILTER (WHERE ${crmContacts.contactType} IN ('media', 'both'))`,
      advocates: sql<number>`count(*) FILTER (WHERE ${crmContacts.contactType} IN ('advocate', 'both'))`,
    })
    .from(crmContacts)
    .where(and(
      inArray(crmContacts.companyId, companyIds),
      sql`${crmContacts.isDeleted} IS NOT TRUE`
    ))
    .groupBy(crmContacts.companyId)

  const map = new Map<number, { total: number; media: number; advocates: number }>()
  for (const row of stats) {
    map.set(row.companyId, {
      total: Number(row.total),
      media: Number(row.media),
      advocates: Number(row.advocates),
    })
  }
  return map
}

export default async function CrmPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const companies = await getUserCompanies(userId)

  // If user has exactly one company, redirect directly to it
  if (companies.length === 1) {
    redirect(`/crm/${companies[0].uuid}`)
  }

  const contactStats = await getContactStats(companies.map((c) => c.id))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CRM Contacts</h1>
        <p className="text-gray-500 dark:text-gray-400">Select a brand to manage contacts</p>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No brands found. <Link href="/company/add" className="text-cyan-700 dark:text-cyan-400 hover:underline">Add a brand</Link> to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map((co) => {
            const stats = contactStats.get(co.id)
            return (
              <Link key={co.id} href={`/crm/${co.uuid}`}>
                <Card className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center gap-3 mb-3">
                      {co.logoUrl ? (
                        <img src={co.logoUrl} alt="" className="h-10 w-10 rounded object-contain" />
                      ) : (
                        <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-400">{co.companyName?.charAt(0)}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">{co.companyName}</p>
                        {co.website && (
                          <p className="text-xs text-gray-400">{co.website}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {stats?.total ?? 0} contacts
                      </span>
                      <span className="flex items-center gap-1">
                        <Newspaper className="h-4 w-4 text-blue-500" />
                        {stats?.media ?? 0} media
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4 text-green-500" />
                        {stats?.advocates ?? 0} advocates
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
