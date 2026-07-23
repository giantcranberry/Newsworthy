'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, Loader2, User, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface UserSearchResult {
  id: number
  email: string
  firstName: string | null
  lastName: string | null
}

interface TransferCounts {
  contacts: number
  images: number
  files: number
  banners: number
  socials: number
  releases: number
  creditEntries: number
  podcastFeeds: number
  approvals: number
  adCampaigns: number
  calendarEvents: number
  consolidatedReports: number
  revokedApiKeys: number
}

interface TransferBrandDialogProps {
  brandUuid: string
  brandName: string
  currentOwnerId: number
  currentOwnerEmail?: string | null
  /** Render as a small table-row button (list page) or a full button (detail page) */
  compact?: boolean
}

export function TransferBrandDialog({
  brandUuid,
  brandName,
  currentOwnerId,
  currentOwnerEmail,
  compact = false,
}: TransferBrandDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TransferCounts | null>(null)

  // User search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const [showResults, setShowResults] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2 || selectedUser) {
      setSearchResults([])
      return
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
          setShowResults(true)
        }
      } catch {
        // Silently fail
      }
    }, 300)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [searchQuery, selectedUser])

  const selectUser = (user: UserSearchResult) => {
    setSelectedUser(user)
    setSearchQuery(user.email)
    setShowResults(false)
  }

  const resetAndClose = () => {
    setOpen(false)
    setSearchQuery('')
    setSearchResults([])
    setSelectedUser(null)
    setError(null)
    setResult(null)
  }

  const handleTransfer = async () => {
    if (!selectedUser) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/brands/${brandUuid}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerId: selectedUser.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Transfer failed')
      }
      setResult(data.counts)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setIsLoading(false)
    }
  }

  const movedSummary = result
    ? [
        result.releases > 0 && `${result.releases} press release${result.releases === 1 ? '' : 's'}`,
        result.creditEntries > 0 && `${result.creditEntries} credit entr${result.creditEntries === 1 ? 'y' : 'ies'}`,
        result.images > 0 && `${result.images} image${result.images === 1 ? '' : 's'}`,
        result.banners > 0 && `${result.banners} banner${result.banners === 1 ? '' : 's'}`,
        result.files > 0 && `${result.files} file${result.files === 1 ? '' : 's'}`,
        result.contacts > 0 && `${result.contacts} contact${result.contacts === 1 ? '' : 's'}`,
        result.socials > 0 && `${result.socials} social profile${result.socials === 1 ? '' : 's'}`,
        result.podcastFeeds > 0 && `${result.podcastFeeds} podcast feed${result.podcastFeeds === 1 ? '' : 's'}`,
        result.adCampaigns > 0 && `${result.adCampaigns} ad campaign${result.adCampaigns === 1 ? '' : 's'}`,
        result.calendarEvents > 0 && `${result.calendarEvents} calendar event${result.calendarEvents === 1 ? '' : 's'}`,
      ].filter(Boolean)
    : []

  return (
    <>
      {compact ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transfer
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <ArrowRightLeft className="h-4 w-4" />
          Transfer Owner
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : resetAndClose())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Brand</DialogTitle>
            <DialogDescription>
              Move <span className="font-medium text-gray-900 dark:text-gray-100">{brandName}</span>
              {currentOwnerEmail ? (
                <> from <span className="font-medium">{currentOwnerEmail}</span></>
              ) : null}{' '}
              to another user account. All brand assets, press releases, and credits move with it.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-900/20 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="text-sm text-green-800 dark:text-green-300">
                  <p className="font-medium">Brand transferred to {selectedUser?.email}</p>
                  {movedSummary.length > 0 && (
                    <p className="mt-1 text-green-700 dark:text-green-400">
                      Moved {movedSummary.join(', ')}.
                    </p>
                  )}
                  {result.revokedApiKeys > 0 && (
                    <p className="mt-1 text-green-700 dark:text-green-400">
                      {result.revokedApiKeys} API key{result.revokedApiKeys === 1 ? '' : 's'} from the
                      previous owner {result.revokedApiKeys === 1 ? 'was' : 'were'} deactivated.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={resetAndClose}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 relative">
                <Label htmlFor="new-owner-search">New owner</Label>
                <Input
                  id="new-owner-search"
                  placeholder="Search by email…"
                  value={searchQuery}
                  autoComplete="off"
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    setSelectedUser(null)
                  }}
                />
                {showResults && searchResults.length > 0 && !selectedUser && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg max-h-56 overflow-y-auto">
                    {searchResults.map((user) => {
                      const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
                      const isCurrent = user.id === currentOwnerId
                      return (
                        <button
                          key={user.id}
                          type="button"
                          disabled={isCurrent}
                          onClick={() => selectUser(user)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="truncate text-gray-900 dark:text-gray-100">{user.email}</span>
                          {name && <span className="text-xs text-gray-500 truncate">{name}</span>}
                          {isCurrent && <span className="ml-auto text-xs text-gray-400">current owner</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                  This moves the brand, its assets, press releases, credit balance, and podcast feeds
                  to <span className="font-medium">{selectedUser.email}</span>. The previous owner
                  loses access. This cannot be undone from this screen.
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={resetAndClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button
                  onClick={handleTransfer}
                  disabled={!selectedUser || isLoading}
                  className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white"
                >
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Transfer Brand
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
