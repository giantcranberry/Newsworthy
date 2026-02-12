'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
  Users,
  UserCheck,
  UserX,
  MailX,
  ArrowLeft,
  Search,
  X,
} from 'lucide-react'

interface Subscriber {
  id: number
  email: string | null
  firstName: string | null
  lastName: string | null
  createdAt: Date | string | null
  lastOpenAt: Date | string | null
  bouncedAt: Date | string | null
  unsubscribeAt: Date | string | null
}

interface SubscriberListProps {
  companyUuid: string
  advocates: Subscriber[]
  stats: {
    total: number
    active: number
    bounced: number
    unsubscribed: number
  }
  filtered: number
  currentPage: number
  totalPages: number
  perPage: number
  query: string
  status: string
}

function formatDate(dateStr: Date | string | null) {
  if (!dateStr) return '—'
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatus(a: Subscriber) {
  if (a.bouncedAt) return 'bounced'
  if (a.unsubscribeAt) return 'unsubscribed'
  return 'active'
}

export function AdvocateList({
  companyUuid,
  advocates,
  stats,
  filtered,
  currentPage,
  totalPages,
  perPage,
  query,
  status,
}: SubscriberListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(query)

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editUnsubscribed, setEditUnsubscribed] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteSubscriber, setDeleteSubscriber] = useState<Subscriber | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Clear selection when page/filters change
  useEffect(() => {
    setSelected(new Set())
  }, [currentPage, query, status, perPage])

  const allOnPageSelected = advocates.length > 0 && advocates.every((a) => selected.has(a.id))
  const someSelected = selected.size > 0

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(advocates.map((a) => a.id)))
    }
  }

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const buildUrl = useCallback((overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [pathname, searchParams])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== query) {
        router.push(buildUrl({ q: searchInput || undefined, page: '1' }))
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, query, router, buildUrl])

  const clearSearch = () => {
    setSearchInput('')
    router.push(buildUrl({ q: undefined, page: '1' }))
  }

  const handlePerPageChange = (value: string) => {
    router.push(buildUrl({ perPage: value, page: '1' }))
  }

  const handleStatusFilter = (value: string) => {
    router.push(buildUrl({ status: status === value ? undefined : value, page: '1' }))
  }

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advocateIds: Array.from(selected) }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove subscribers')
      }

      const data = await response.json()
      setShowBulkDeleteModal(false)
      setSelected(new Set())
      setSuccess(`Removed ${data.deleted} subscriber${data.deleted !== 1 ? 's' : ''}.`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove subscribers')
      setShowBulkDeleteModal(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const openEdit = (a: Subscriber) => {
    setEditId(a.id)
    setEditEmail(a.email || '')
    setEditFirstName(a.firstName || '')
    setEditLastName(a.lastName || '')
    setEditUnsubscribed(!!a.unsubscribeAt)
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEditSave = async () => {
    setIsSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          advocateId: editId,
          email: editEmail,
          firstName: editFirstName,
          lastName: editLastName,
          unsubscribed: editUnsubscribed,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update subscriber')
      }

      setShowEditModal(false)
      setSuccess('Subscriber updated.')
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const openDelete = (a: Subscriber) => {
    setDeleteSubscriber(a)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteSubscriber) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advocateId: deleteSubscriber.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove subscriber')
      }

      setShowDeleteModal(false)
      setDeleteSubscriber(null)
      setSuccess('Subscriber removed.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setIsDeleting(false)
    }
  }

  const startRecord = (currentPage - 1) * perPage + 1
  const endRecord = Math.min(currentPage * perPage, filtered)

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      {/* Back link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/company/${companyUuid}/advocacy`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Share List Settings
        </Link>
      </div>

      {/* Stats — click to filter */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${!status ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}
          onClick={() => handleStatusFilter(status || '')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'active' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50'}`}
          onClick={() => handleStatusFilter('active')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <UserCheck className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-gray-500">Active</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'bounced' ? 'ring-2 ring-red-500' : 'hover:bg-gray-50'}`}
          onClick={() => handleStatusFilter('bounced')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <MailX className="h-5 w-5 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.bounced}</p>
            <p className="text-xs text-gray-500">Bounced</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'unsubscribed' ? 'ring-2 ring-amber-500' : 'hover:bg-gray-50'}`}
          onClick={() => handleStatusFilter('unsubscribed')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <UserX className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.unsubscribed}</p>
            <p className="text-xs text-gray-500">Unsubscribed</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-red-800">
            {selected.size} subscriber{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear Selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowBulkDeleteModal(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Subscribers Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              Subscribers ({stats.total})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(query || status) && (
            <p className="text-xs text-gray-500 mb-3">
              Showing {filtered} result{filtered !== 1 ? 's' : ''}
              {status && <> with status <span className="font-medium capitalize">{status}</span></>}
              {query && <> matching &ldquo;{query}&rdquo;</>}
            </p>
          )}

          {advocates.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 pr-2 w-8">
                        <Checkbox
                          checked={allOnPageSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all on this page"
                        />
                      </th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Subscriber</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Member Since</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Last Open</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {advocates.map((a) => {
                      const rowStatus = getStatus(a)
                      const isSelected = selected.has(a.id)
                      return (
                        <tr key={a.id} className={`border-b last:border-0 ${isSelected ? 'bg-red-50/50' : ''}`}>
                          <td className="py-2 pr-2">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(a.id)}
                              aria-label={`Select ${a.email}`}
                            />
                          </td>
                          <td className="py-2 pr-4">
                            {(a.firstName || a.lastName) && (
                              <>
                                <span className="font-medium text-gray-900">
                                  {[a.firstName, a.lastName].filter(Boolean).join(' ')}
                                </span>
                                <br />
                              </>
                            )}
                            <span className="text-gray-500">{a.email}</span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600">{formatDate(a.createdAt)}</td>
                          <td className="py-2 pr-4 text-gray-600">{formatDate(a.lastOpenAt)}</td>
                          <td className="py-2 pr-4">
                            {rowStatus === 'active' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Active
                              </span>
                            )}
                            {rowStatus === 'bounced' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                Bounced
                              </span>
                            )}
                            {rowStatus === 'unsubscribed' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                Unsubscribed
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEdit(a)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit subscriber"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDelete(a)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove subscriber"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Rows per page:</span>
                  <Select
                    value={String(perPage)}
                    onChange={(e) => handlePerPageChange(e.target.value)}
                    className="w-[70px] h-8"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </Select>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {startRecord}–{endRecord} of {filtered}
                  </span>
                  <div className="flex items-center gap-1">
                    {currentPage > 1 ? (
                      <Link
                        href={buildUrl({ page: String(currentPage - 1) })}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-600 hover:bg-gray-100"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-300">
                        <ChevronLeft className="h-4 w-4" />
                      </span>
                    )}

                    {currentPage < totalPages ? (
                      <Link
                        href={buildUrl({ page: String(currentPage + 1) })}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-600 hover:bg-gray-100"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-300">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              {query || status
                ? 'No subscribers match the current filters.'
                : 'No subscribers yet. Add subscribers from the Share List settings page.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {selected.size} Subscriber{selected.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the selected subscribers from your list? This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove {selected.size} Subscriber{selected.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Subscriber</DialogTitle>
            <DialogDescription>
              Update this subscriber&apos;s details.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{editError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="edit-email">Email *</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-unsubscribed"
                checked={editUnsubscribed}
                onCheckedChange={(checked) => setEditUnsubscribed(checked === true)}
              />
              <Label htmlFor="edit-unsubscribed" className="text-sm font-normal cursor-pointer">
                Mark as unsubscribed
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Subscriber</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this subscriber from your list?
            </DialogDescription>
          </DialogHeader>

          {deleteSubscriber && (
            <div className="py-2">
              <p className="text-sm font-medium text-gray-900">
                {[deleteSubscriber.firstName, deleteSubscriber.lastName].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-gray-500">{deleteSubscriber.email}</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Remove Subscriber
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
