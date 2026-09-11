'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, Clock, ExternalLink, Loader2, User } from 'lucide-react'

export type StuckStakeholderRelease = {
  releaseId: number
  releaseUuid: string
  title: string | null
  status: string
  requestedAt: string | null
  pendingApprovers: number
  companyName: string | null
  userId: number
  userEmail: string
  firstName: string | null
  lastName: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StuckSection({
  stakeholderReleases,
}: {
  stakeholderReleases: StuckStakeholderRelease[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(stakeholderReleases)
  const [clearingUuid, setClearingUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const count = rows.length

  useEffect(() => {
    setRows(stakeholderReleases)
  }, [stakeholderReleases])

  const handleClear = async (releaseUuid: string) => {
    setClearingUuid(releaseUuid)
    setError(null)

    try {
      const res = await fetch(`/api/admin/releases/${releaseUuid}/approvals`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear approval requests')
      }

      setRows((prev) => prev.filter((row) => row.releaseUuid !== releaseUuid))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear approval requests')
    } finally {
      setClearingUuid(null)
    }
  }

  return (
    <div className="space-y-3" data-tour="admin-stuck-section">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Stuck</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Releases blocked and waiting on someone else
        </p>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <Card
          data-tour="admin-stuck-stakeholder-approval"
          className={
            count > 0
              ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'
              : undefined
          }
        >
          <CardHeader className={open ? 'pb-3' : 'pb-6'}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center justify-between gap-3 text-left cursor-pointer"
                data-tour="admin-stuck-stakeholder-toggle"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base">Stakeholder Approval</CardTitle>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-normal">
                      {count === 0
                        ? 'No releases waiting on stakeholders'
                        : `${count} release${count !== 1 ? 's' : ''} pending approval`}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={count > 0 ? 'default' : 'secondary'}
                  className={
                    count > 0
                      ? 'bg-amber-600 hover:bg-amber-600 text-white tabular-nums'
                      : 'tabular-nums'
                  }
                >
                  {count}
                </Badge>
              </button>
            </CollapsibleTrigger>
          </CardHeader>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {count === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">
                  Nothing stuck here right now.
                </p>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
                  {rows.map((row) => {
                    const fullName = [row.firstName, row.lastName].filter(Boolean).join(' ')
                    const canClear = row.status === 'sent'
                    const isClearing = clearingUuid === row.releaseUuid

                    return (
                      <div
                        key={row.releaseId}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        data-tour="admin-stuck-stakeholder-row"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/pr/${row.releaseUuid}/finalize`}
                              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline truncate"
                            >
                              {row.title || 'Untitled Press Release'}
                            </Link>
                            <Badge variant="outline" className="text-xs capitalize">
                              {row.status}
                            </Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {row.pendingApprovers} pending approver
                              {row.pendingApprovers !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {row.companyName || 'No company'}
                            {' · '}
                            Requested {formatDate(row.requestedAt)}
                          </p>
                          <Link
                            href={`/admin/users/${row.userId}`}
                            className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <User className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {fullName || row.userEmail}
                              {fullName ? ` · ${row.userEmail}` : ''}
                            </span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </Link>
                        </div>

                        {canClear && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={isClearing}
                            onClick={() => handleClear(row.releaseUuid)}
                            data-tour="admin-stuck-clear-approvals"
                          >
                            {isClearing ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Clearing…
                              </>
                            ) : (
                              'Clear approval request'
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
