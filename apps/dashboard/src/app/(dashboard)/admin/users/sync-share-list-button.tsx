'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Users, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface Brand {
  id: number
  uuid: string
  companyName: string
  ownerEmail: string
}

export function SyncShareListButton() {
  const [open, setOpen] = useState(false)
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingBrands, setLoadingBrands] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    added: number
    skipped: number
    emailsSent: number
    emailErrors: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLoadingBrands(true)
      setResult(null)
      setError(null)
      fetch('/api/admin/sync-share-lists')
        .then((res) => res.json())
        .then((data) => {
          setBrands(data.brands || [])
        })
        .catch(() => setError('Failed to load brands'))
        .finally(() => setLoadingBrands(false))
    }
  }, [open])

  const handleSync = async () => {
    if (!selectedBrandId) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-share-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: parseInt(selectedBrandId) }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Sync to Share List
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync Users to Share List</DialogTitle>
          <DialogDescription>
            Add all platform users to a brand's Share List. Only new users will be added — existing members are skipped. Welcome emails will be sent to new additions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {loadingBrands ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading brands...
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Select Brand Profile
              </label>
              <Select
                value={selectedBrandId}
                onChange={(e) => {
                  setSelectedBrandId(e.target.value)
                  setResult(null)
                  setError(null)
                }}
              >
                <option value="">Choose a brand...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id.toString()}>
                    {b.companyName} ({b.ownerEmail})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                <CheckCircle className="h-4 w-4" />
                Sync Complete
              </div>
              <div className="text-sm text-green-800 dark:text-green-300 space-y-1">
                <p><strong>{result.added}</strong> new users added to Share List</p>
                <p><strong>{result.skipped}</strong> already existed (skipped)</p>
                <p><strong>{result.emailsSent}</strong> welcome emails sent</p>
                {result.emailErrors > 0 && (
                  <p className="text-amber-600 dark:text-amber-400">
                    <strong>{result.emailErrors}</strong> email failures
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button
                onClick={handleSync}
                disabled={!selectedBrandId || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Syncing...
                  </>
                ) : (
                  'Sync Users'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
