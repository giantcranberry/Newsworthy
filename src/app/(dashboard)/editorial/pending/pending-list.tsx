'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface PendingItem {
  id: number
  uuid: string
  title: string | null
  distribution: string | null
  releaseAt: string | null
  timezone: string | null
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

export function PendingList({ items }: { items: PendingItem[] }) {
  const router = useRouter()
  const [pullConfirm, setPullConfirm] = useState<number | null>(null)
  const [loading, setLoading] = useState<Record<number, boolean>>({})

  const handlePull = async (item: PendingItem) => {
    setLoading((prev) => ({ ...prev, [item.id]: true }))
    try {
      const res = await fetch('/api/editorial/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: item.id }),
      })
      if (res.ok) {
        setPullConfirm(null)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to pull release')
      }
    } catch (e) {
      alert('Failed to pull release')
    } finally {
      setLoading((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-900">
                {item.title || 'Untitled Release'}
              </h3>
              <DistributionBadge distribution={item.distribution} />
            </div>

            <p className="text-xs text-gray-500 mb-3">
              For Release {formatDate(item.releaseAt)}
            </p>

            {pullConfirm === item.id ? (
              <div className="bg-red-50 rounded-md p-3">
                <p className="text-sm font-medium text-red-800 mb-2">
                  Are you sure you want to pull this release back to draft?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700 h-7 text-xs"
                    onClick={() => handlePull(item)}
                    disabled={loading[item.id]}
                  >
                    {loading[item.id] ? 'Pulling...' : 'Yes, Pull to Draft'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setPullConfirm(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href={`/editorial/edit/${item.id}`}>
                  <Button size="sm" className="bg-cyan-800 text-white hover:bg-cyan-900 h-7 text-xs">
                    Edit
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setPullConfirm(item.id)}
                >
                  Pull
                </Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
