import { getEffectiveSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { getCompanyAccess } from '@/lib/team-auth'
import { getCuratedListPage, getMediaList, CURATED_SEND_WINDOW_DAYS } from '@/lib/media-lists'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Lock, Search, Sparkles } from 'lucide-react'

const PER_PAGE = 25

// Read-only, masked view of the Newsworthy Curated list: name + outlet only.
// Emails never reach this page (getCuratedListPage doesn't select them).
export default async function CuratedListPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string; listUuid: string }>
  searchParams: Promise<{ page?: string; q?: string }>
}) {
  const { uuid, listUuid } = await params
  const { page: pageStr, q } = await searchParams
  const page = Math.max(1, parseInt(pageStr || '1') || 1)
  const query = q?.trim() || ''

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company

  const list = await getMediaList(co.id, listUuid)
  if (!list || !list.isCurated) notFound()

  const data = await getCuratedListPage(list, co.id, { page, perPage: PER_PAGE, query })

  const pageHref = (p: number) => {
    const sp = new URLSearchParams()
    if (query) sp.set('q', query)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/company/${co.uuid}/pitchlist/curated/${list.uuid}${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{list.groupName}</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />

      <Link
        href={`/company/${co.uuid}/pitchlist`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Distribution
      </Link>

      <Card className="border-cyan-200 dark:border-cyan-900">
        <CardContent className="py-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-cyan-700 dark:text-cyan-400 mt-0.5 shrink-0" />
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
            <p>
              Newsworthy researched these journalists for {co.companyName} based on your newsroom. The list is managed by
              Newsworthy: contact details stay private and the list can&apos;t be edited or exported.
            </p>
            <p>
              Select it on the Share step when you publish. Each journalist receives at most one release from you every{' '}
              {CURATED_SEND_WINDOW_DAYS} days.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              Journalists ({data.total})
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Managed by Newsworthy
              </Badge>
            </CardTitle>
            <form className="relative w-64" action={`/company/${co.uuid}/pitchlist/curated/${list.uuid}`}>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input name="q" defaultValue={query} placeholder="Search name or outlet..." className="pl-9 h-9" />
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {data.items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
              {query ? <>No journalists match &ldquo;{query}&rdquo;.</> : 'Newsworthy is still researching journalists for your brand.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Outlet</th>
                    <th className="py-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((j) => (
                    <tr key={j.id} className="border-b border-gray-100 dark:border-gray-900 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">{j.name}</td>
                      <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{j.publication || '—'}</td>
                      <td className="py-2.5 text-right">
                        {j.recentlyEmailed ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                            <Clock className="h-3 w-3" />
                            Emailed in last {CURATED_SEND_WINDOW_DAYS} days
                          </span>
                        ) : (
                          <span className="text-xs text-green-700 dark:text-green-400">Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 text-sm text-gray-500 dark:text-gray-400">
              <span>Page {data.page} of {data.totalPages}</span>
              <div className="flex gap-2">
                {data.page > 1 ? (
                  <Link href={pageHref(data.page - 1)}><Button variant="outline" size="sm"><ChevronLeft className="h-4 w-4" />Previous</Button></Link>
                ) : (
                  <Button variant="outline" size="sm" disabled><ChevronLeft className="h-4 w-4" />Previous</Button>
                )}
                {data.page < data.totalPages ? (
                  <Link href={pageHref(data.page + 1)}><Button variant="outline" size="sm">Next<ChevronRight className="h-4 w-4" /></Button></Link>
                ) : (
                  <Button variant="outline" size="sm" disabled>Next<ChevronRight className="h-4 w-4" /></Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
