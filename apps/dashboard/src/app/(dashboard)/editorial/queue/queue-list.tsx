'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { normalizeTimezone, tzLabel } from '@/lib/timezones'
import { AlertTriangle } from 'lucide-react'

interface QueueItem {
  queueId: number
  queueUuid: string
  releaseId: number
  releaseUuid: string
  title: string | null
  abstract: string | null
  distribution: string | null
  companyName: string | null
  userEmail: string
  submitted: string | null
  releaseAt: string | null
  timezone: string | null
  checkedout: string | null
  editorId: number | null
  editorName: string | null
  blockedTerms: string[]
}

function DistributionBadge({ distribution }: { distribution: string | null }) {
  if (distribution === 'yahoo') {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-purple-700 text-white">
        YAHOO
      </span>
    )
  }
  if (distribution === 'enhanced') {
    return (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-blue-900 text-white">
        ENHANCED
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold bg-gray-500 text-white">
      STANDARD
    </span>
  )
}

function BlocklistWarning({ terms }: { terms: string[] }) {
  const [open, setOpen] = useState(false)
  if (!terms.length) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/70 cursor-pointer"
        title="Blocked keywords found in this release"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Block list ({terms.length})
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-400 mb-1.5">
            Matched terms
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {terms.map((term) => (
              <li
                key={term}
                className="rounded bg-white px-2 py-0.5 text-xs font-medium text-amber-950 ring-1 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700"
              >
                {term}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return 'N/A'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatReleaseDate(iso: string | null, tz: string | null) {
  if (!iso) return 'Immediate'
  const timezone = normalizeTimezone(tz)
  const d = new Date(iso)
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(d)
  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d)
  return `${dateStr} ${timeStr} ${tzLabel(tz)}`
}

export function QueueList({
  items,
  currentUserId,
  currentUserName,
}: {
  items: QueueItem[]
  currentUserId: number
  currentUserName: string
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  const handleCheckout = async (item: QueueItem) => {
    setLoading((prev) => ({ ...prev, [`checkout-${item.queueId}`]: true }))
    try {
      const res = await fetch('/api/editorial/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: item.queueId,
          editorId: currentUserId,
          editorName: currentUserName,
        }),
      })
      if (res.ok) router.refresh()
    } catch (e) {
      console.error('Checkout failed:', e)
    } finally {
      setLoading((prev) => ({ ...prev, [`checkout-${item.queueId}`]: false }))
    }
  }

  const handleDisown = async (item: QueueItem) => {
    setLoading((prev) => ({ ...prev, [`disown-${item.queueId}`]: true }))
    try {
      const res = await fetch('/api/editorial/disown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: item.queueId,
          releaseId: item.releaseId,
          editorId: currentUserId,
          editorName: currentUserName,
        }),
      })
      if (res.ok) router.refresh()
    } catch (e) {
      console.error('Disown failed:', e)
    } finally {
      setLoading((prev) => ({ ...prev, [`disown-${item.queueId}`]: false }))
    }
  }

  const handleCapture = async (item: QueueItem) => {
    setLoading((prev) => ({ ...prev, [`capture-${item.queueId}`]: true }))
    try {
      const res = await fetch('/api/editorial/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueId: item.queueId,
          editorId: currentUserId,
          editorName: currentUserName,
        }),
      })
      if (res.ok) router.refresh()
    } catch (e) {
      console.error('Capture failed:', e)
    } finally {
      setLoading((prev) => ({ ...prev, [`capture-${item.queueId}`]: false }))
    }
  }

  const isCheckedOutByMe = (item: QueueItem) => item.editorId === currentUserId
  const isCheckedOutByOther = (item: QueueItem) => item.editorId !== null && item.editorId !== currentUserId
  const isNotCheckedOut = (item: QueueItem) => !item.editorId

  return (
    <div data-tour="queue-list" className="space-y-3">
      {items.map((item, index) => (
        <Card key={item.queueId} className="overflow-hidden" {...(index === 0 ? { "data-tour": "queue-first-item" } : {})}>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Link href={`/editorial/review/${item.releaseUuid}`}>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400 cursor-pointer">
                      {item.title || 'Untitled Release'}
                    </h3>
                  </Link>
                  {index === 0 ? (
                    <span data-tour="queue-distribution">
                      <DistributionBadge distribution={item.distribution} />
                    </span>
                  ) : (
                    <DistributionBadge distribution={item.distribution} />
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {item.companyName} &mdash; {item.userEmail}
                </p>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Submitted {formatDate(item.submitted)}
                  {' / '}
                  For Release {formatReleaseDate(item.releaseAt, item.timezone)}
                </p>

                {/* Checkout Status */}
                {item.checkedout && item.editorId && (
                  <p className="text-xs mt-1">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">CHECKED OUT</span>
                    {' '}
                    <span className="text-gray-500 dark:text-gray-400">
                      {formatDate(item.checkedout)} <em>({item.editorName})</em>
                    </span>
                  </p>
                )}

                <BlocklistWarning terms={item.blockedTerms} />

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 flex-wrap" {...(index === 0 ? { "data-tour": "queue-actions" } : {})}>
                  {isCheckedOutByMe(item) && (
                    <>
                      <Link href={`/editorial/edit/${item.releaseId}`}>
                        <Button size="sm" className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 text-xs h-7">
                          Edit / Approve
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => handleDisown(item)}
                        disabled={loading[`disown-${item.queueId}`]}
                      >
                        {loading[`disown-${item.queueId}`] ? 'Releasing...' : 'Disown'}
                      </Button>
                    </>
                  )}

                  {isCheckedOutByOther(item) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => handleCapture(item)}
                      disabled={loading[`capture-${item.queueId}`]}
                    >
                      {loading[`capture-${item.queueId}`] ? 'Capturing...' : 'Capture'}
                    </Button>
                  )}

                  {isNotCheckedOut(item) && (
                    <Button
                      size="sm"
                      className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 text-xs h-7"
                      onClick={() => handleCheckout(item)}
                      disabled={loading[`checkout-${item.queueId}`]}
                    >
                      {loading[`checkout-${item.queueId}`] ? 'Checking out...' : 'Checkout'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
