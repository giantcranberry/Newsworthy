import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company } from '@/db/schema'
import { eq, desc, and, or, inArray } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { reportReady } from '@/services/report'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, Share2 } from 'lucide-react'
import { BrandFilter } from './brand-filter'
import { ReportsTable } from './reports-table'

const PER_PAGE = 20

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; brand?: string }>
}) {
  const { page: pageParam, brand: brandParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1'))
  const brandFilter = brandParam ? parseInt(brandParam) : null
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) return <p>Unauthorized</p>

  const companyIds = await getUserCompanyIds(userId)

  // Fetch user's companies for the filter dropdown
  const userCompanies = companyIds.length > 0
    ? await db.query.company.findMany({
        where: and(
          inArray(company.id, companyIds),
          eq(company.isDeleted, false),
        ),
      })
    : []

  const sentReleases = await db.query.releases.findMany({
    where: and(
      eq(releases.status, 'sent'),
      or(
        eq(releases.userId, userId),
        companyIds.length > 0 ? inArray(releases.companyId, companyIds) : undefined,
      ),
      brandFilter ? eq(releases.companyId, brandFilter) : undefined,
    ),
    orderBy: desc(releases.releasedAt),
    with: { company: true },
  })

  const total = sentReleases.length
  const totalPages = Math.ceil(total / PER_PAGE)
  const paginated = sentReleases.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">View clipping reports, or select releases to build a consolidated report</p>
        </div>
        <div className="flex items-center gap-2">
          {userCompanies.length > 1 && (
            <div data-tour="reports-brand-filter">
              <BrandFilter
                brands={userCompanies.map((c) => ({ id: c.id, name: c.companyName }))}
                currentBrand={brandFilter}
              />
            </div>
          )}
          <Link href="/pr/reports/shared">
            <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
              <Share2 className="h-3.5 w-3.5" />
              Shared Reports
            </Button>
          </Link>
        </div>
      </div>

      {paginated.length === 0 ? (
        <Card data-tour="reports-empty">
          <CardContent className="py-16 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No Published Releases Yet</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">Once your releases are published, reports will appear here.</p>
            <Link href="/pr/create">
              <Button className="mt-6 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
                Create a Release
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ReportsTable
          rows={paginated.map((r) => ({
            id: r.id,
            uuid: r.uuid,
            title: r.title,
            companyName: r.company?.companyName ?? null,
            releasedAt: r.releasedAt ? new Date(r.releasedAt).toISOString() : null,
            ready: reportReady(r.releasedAt),
          }))}
          page={page}
          totalPages={totalPages}
          brandFilter={brandFilter}
        />
      )}
    </div>
  )
}
