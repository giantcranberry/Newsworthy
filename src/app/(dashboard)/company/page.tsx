import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, brandCredits } from '@/db/schema'
import { eq, and, desc, isNull, sql } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Plus, Edit, ExternalLink, CreditCard } from 'lucide-react'

async function getUserCompanies(userId: number) {
  return await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false),
      eq(company.isArchived, false)
    ),
    orderBy: desc(company.id),
  })
}

async function getBrandCredits(companyIds: number[]): Promise<Map<number, number>> {
  if (companyIds.length === 0) return new Map()

  const results = await db
    .select({
      companyId: brandCredits.companyId,
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
    })
    .from(brandCredits)
    .where(
      and(
        isNull(brandCredits.prId), // Only unused credits
        sql`${brandCredits.companyId} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})`
      )
    )
    .groupBy(brandCredits.companyId)

  const creditMap = new Map<number, number>()
  for (const row of results) {
    if (row.companyId !== null) {
      creditMap.set(row.companyId, Number(row.balance))
    }
  }
  return creditMap
}

export default async function CompaniesPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const companies = await getUserCompanies(userId)
  const companyIds = companies.map(c => c.id)
  const creditsByCompany = await getBrandCredits(companyIds)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-gray-500">Manage your company and brand profiles</p>
        </div>
        <Link href="/company/add">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Brand
          </Button>
        </Link>
      </div>

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No brands yet</h3>
            <p className="mt-2 text-gray-500">
              Add your first brand to start creating press releases.
            </p>
            <Link href="/company/add">
              <Button className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Add Brand
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((co) => (
            <Card key={co.id} className="overflow-hidden">
              <CardContent className="p-0">
                {/* Logo Header */}
                <div className="flex items-center justify-center h-32 bg-gray-100">
                  {co.logoUrl ? (
                    <img
                      src={co.logoUrl}
                      alt={co.companyName}
                      className="max-h-20 max-w-[80%] object-contain"
                    />
                  ) : (
                    <Building2 className="h-16 w-16 text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <Link href={`/company/${co.uuid}`}>
                    <h3 className="font-semibold text-gray-900 hover:text-blue-600">
                      {co.companyName}
                    </h3>
                  </Link>
                  {co.website && (
                    <a
                      href={co.website.startsWith('http') ? co.website : `https://${co.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      {co.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {co.city && co.state && (
                    <p className="mt-1 text-sm text-gray-500">
                      {co.city}, {co.state}
                    </p>
                  )}

                  {/* Credits Badge */}
                  <div className="mt-3 flex items-center gap-1.5 text-sm">
                    <CreditCard className="h-4 w-4 text-gray-400" />
                    <span className={`font-medium ${(creditsByCompany.get(co.id) || 0) > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {creditsByCompany.get(co.id) || 0} credits
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link href={`/company/${co.uuid}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/pr/create?company=${co.uuid}`} className="flex-1">
                      <Button size="sm" className="w-full">
                        New Release
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
