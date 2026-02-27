'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface EnhancedQueueItem {
  releaseId: number
  releaseUuid: string
  title: string | null
  distribution: string | null
  releasedAt: string | null
  enhancedId: number | null
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
      {distribution?.toUpperCase() || 'STANDARD'}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return 'Not yet released'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function EnhancedQueueList({ items }: { items: EnhancedQueueItem[] }) {
  const router = useRouter()
  const [urls, setUrls] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSaveUrl = async (item: EnhancedQueueItem) => {
    const url = urls[item.releaseId]
    if (!url?.trim()) return

    setLoading((prev) => ({ ...prev, [`url-${item.releaseId}`]: true }))
    try {
      const res = await fetch('/api/editorial/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: item.releaseId,
          reportUrl: url.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Report URL saved for release ${item.releaseId}` })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save URL' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save URL' })
    } finally {
      setLoading((prev) => ({ ...prev, [`url-${item.releaseId}`]: false }))
    }
  }

  const handleResetStandard = async (item: EnhancedQueueItem) => {
    if (!confirm('Reset this release to standard distribution?')) return

    setLoading((prev) => ({ ...prev, [`reset-${item.releaseId}`]: true }))
    try {
      const res = await fetch('/api/editorial/enhanced', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: item.releaseId,
          action: 'reset_standard',
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Release ${item.releaseId} reset to standard distribution` })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reset' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to reset distribution' })
    } finally {
      setLoading((prev) => ({ ...prev, [`reset-${item.releaseId}`]: false }))
    }
  }

  return (
    <div className="space-y-3">
      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {items.map((item) => (
        <Card key={item.releaseId} className="overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-base font-semibold text-gray-900">
                {item.title || 'Untitled Release'}
              </h3>
              <DistributionBadge distribution={item.distribution} />
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Released: {formatDate(item.releasedAt)}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="url"
                placeholder="Enter report URL"
                value={urls[item.releaseId] || ''}
                onChange={(e) => setUrls((prev) => ({ ...prev, [item.releaseId]: e.target.value }))}
                className="flex-1 min-w-[300px] h-8 text-sm"
              />
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700 h-8 text-xs"
                onClick={() => handleSaveUrl(item)}
                disabled={loading[`url-${item.releaseId}`] || !urls[item.releaseId]?.trim()}
              >
                {loading[`url-${item.releaseId}`] ? 'Saving...' : 'Save URL'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => handleResetStandard(item)}
                disabled={loading[`reset-${item.releaseId}`]}
              >
                {loading[`reset-${item.releaseId}`] ? 'Resetting...' : 'Reset to Standard'}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
