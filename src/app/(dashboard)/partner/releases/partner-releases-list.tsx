'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, ExternalLink, FileText } from 'lucide-react'

interface ReleaseData {
  id: number
  uuid: string
  title: string | null
  status: string
  createdAt: Date | null
  releasedAt: Date | null
  companyName: string | null
  userName: string
  userId: number
  reportReady: boolean
}

interface UserOption {
  id: number
  label: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'start', label: 'Draft' },
  { value: 'review', label: 'In Review' },
  { value: 'sent', label: 'Sent' },
]

function buildUrl(params: { user?: number | null; status?: string | null; page?: number; partnerId?: number }) {
  const searchParams = new URLSearchParams()
  if (params.partnerId) searchParams.set('partner', params.partnerId.toString())
  if (params.user) searchParams.set('user', params.user.toString())
  if (params.status) searchParams.set('status', params.status)
  if (params.page && params.page > 1) searchParams.set('page', params.page.toString())
  const qs = searchParams.toString()
  return `/partner/releases${qs ? `?${qs}` : ''}`
}

export function PartnerReleasesList({
  releases,
  users,
  currentUser,
  currentStatus,
  page,
  totalPages,
  currentPartnerId,
}: {
  releases: ReleaseData[]
  users: UserOption[]
  currentUser: number | null
  currentStatus: string | null
  page: number
  totalPages: number
  currentPartnerId?: number
}) {
  const router = useRouter()

  const statusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Sent</span>
      case 'review':
        return <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">In Review</span>
      case 'start':
        return <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">Draft</span>
      default:
        return <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">{status}</span>
    }
  }

  if (releases.length === 0 && !currentUser && !currentStatus) {
    return (
      <Card data-tour="partner-releases-empty">
        <CardContent className="py-16 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No Press Releases Yet</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            No press releases have been created by partner users yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Filters */}
      <div data-tour="partner-releases-filters" className="inline-flex flex-wrap gap-3">
        <select
          value={currentUser?.toString() || ''}
          onChange={(e) => {
            const userId = e.target.value ? parseInt(e.target.value) : null
            router.push(buildUrl({ user: userId, status: currentStatus, partnerId: currentPartnerId }))
          }}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 shadow-sm dark:shadow-gray-900/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>

        <select
          value={currentStatus || ''}
          onChange={(e) => {
            const status = e.target.value || null
            router.push(buildUrl({ user: currentUser, status, partnerId: currentPartnerId }))
          }}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 shadow-sm dark:shadow-gray-900/50 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {releases.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No releases match your filters.</p>
      ) : (
        <>
          <div data-tour="partner-releases-table" className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Reports
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {releases.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950" {...(index === 0 ? { "data-tour": "partner-releases-first-row" } : {})}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {(r.releasedAt || r.createdAt)
                        ? new Date(r.releasedAt || r.createdAt!).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                      <div className="max-w-md truncate">{r.title || 'Untitled'}</div>
                      {r.companyName && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.companyName}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      <Link
                        href={buildUrl({ user: r.userId, status: currentStatus, partnerId: currentPartnerId })}
                        className="text-cyan-700 hover:text-cyan-900 dark:hover:text-cyan-300"
                      >
                        {r.userName}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {statusBadge(r.status)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                      {r.status === 'sent' && r.reportReady ? (
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/pr/clips/${r.uuid}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 cursor-pointer"
                            >
                              <BarChart3 className="h-3.5 w-3.5" />
                              Report
                            </Button>
                          </Link>
                          <Link href={`/pr/clipsreport/${r.uuid}`} target="_blank">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 cursor-pointer"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Share
                            </Button>
                          </Link>
                        </div>
                      ) : r.status === 'sent' ? (
                        <span className="text-gray-400 italic">Pending...</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={buildUrl({ user: currentUser, status: currentStatus, page: page - 1, partnerId: currentPartnerId })}>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Previous
                  </Button>
                </Link>
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildUrl({ user: currentUser, status: currentStatus, page: page + 1, partnerId: currentPartnerId })}>
                  <Button variant="outline" size="sm" className="cursor-pointer">
                    Next
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
