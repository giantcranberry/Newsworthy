import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company } from '@/db/schema'
import { eq, desc, and, or, inArray } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { reportReady } from '@/services/report'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BarChart3, ExternalLink } from 'lucide-react'
import { BrandFilter } from './brand-filter'

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
          <p className="text-gray-600 dark:text-gray-400">View clipping reports for your published releases</p>
        </div>
        {userCompanies.length > 1 && (
          <div data-tour="reports-brand-filter">
            <BrandFilter
              brands={userCompanies.map((c) => ({ id: c.id, name: c.companyName }))}
              currentBrand={brandFilter}
            />
          </div>
        )}
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
        <>
          <div data-tour="reports-table" className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead data-tour="reports-columns" className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date Released
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Press Release Title
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Reports
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {paginated.map((r, index) => {
                  const ready = reportReady(r.releasedAt)
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950" {...(index === 0 ? { "data-tour": "reports-first-row" } : {})}>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {r.releasedAt
                          ? new Date(r.releasedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                        <div className="max-w-lg truncate">{r.title || 'Untitled'}</div>
                        {r.company?.companyName && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.company.companyName}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        {ready ? (
                          <div className="flex items-center justify-end gap-2" {...(index === 0 ? { "data-tour": "reports-actions" } : {})}>
                            <Link href={`/pr/clips/${r.uuid}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 cursor-pointer"
                              >
                                <BarChart3 className="h-3.5 w-3.5" />
                                Full Report
                              </Button>
                            </Link>
                            <Link
                              href={`/pr/clipsreport/${r.uuid}`}
                              target="_blank"
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 cursor-pointer"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Shareable
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Pending...</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={`/pr/reports?page=${page - 1}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={`/pr/reports?page=${page + 1}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
