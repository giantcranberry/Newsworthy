'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  Eye,
  Newspaper,
} from 'lucide-react'

interface Contact {
  id: number
  uuid: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  tld: string | null
  publication: string | null
  phone: string | null
  notes: string | null
  source: string | null
  linkedin: string | null
  twitter: string | null
  facebook: string | null
  instagram: string | null
  crunchbase: string | null
  youtube: string | null
  emailCount: number | null
  createdAt: Date | string | null
  lastOpenAt: Date | string | null
  bouncedAt: Date | string | null
  unsubscribeAt: Date | string | null
}

interface ContactListProps {
  companyUuid: string
  contacts: Contact[]
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

function getStatus(c: Contact) {
  if (c.bouncedAt) return 'bounced'
  if (c.unsubscribeAt) return 'unsubscribed'
  return 'active'
}

export function ContactList({
  companyUuid,
  contacts,
  stats,
  filtered,
  currentPage,
  totalPages,
  perPage,
  query,
  status,
}: ContactListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(query)

  // Selection state — use uuid strings
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // View state
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewContact, setViewContact] = useState<Contact | null>(null)

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editUuid, setEditUuid] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editTld, setEditTld] = useState('')
  const [editPublication, setEditPublication] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editUnsubscribed, setEditUnsubscribed] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteContact, setDeleteContact] = useState<Contact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Clear selection when page/filters change
  useEffect(() => {
    setSelected(new Set())
  }, [currentPage, query, status, perPage])

  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => c.uuid && selected.has(c.uuid))
  const someSelected = selected.size > 0

  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(contacts.map((c) => c.uuid).filter(Boolean) as string[]))
    }
  }

  const toggleSelect = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uuid)) {
        next.delete(uuid)
      } else {
        next.add(uuid)
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

  // Bulk delete
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/pitchlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUuids: Array.from(selected) }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove contacts')
      }

      const data = await response.json()
      setShowBulkDeleteModal(false)
      setSelected(new Set())
      setSuccess(`Removed ${data.deleted} contact${data.deleted !== 1 ? 's' : ''}.`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove contacts')
      setShowBulkDeleteModal(false)
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // View contact
  const openView = (c: Contact) => {
    setViewContact(c)
    setShowViewModal(true)
  }

  // Edit contact
  const openEdit = (c: Contact) => {
    setEditUuid(c.uuid)
    setEditEmail(c.email || '')
    setEditFirstName(c.firstName || '')
    setEditLastName(c.lastName || '')
    setEditTld(c.tld || '')
    setEditPublication(c.publication || '')
    setEditPhone(c.phone || '')
    setEditNotes(c.notes || '')
    setEditUnsubscribed(!!c.unsubscribeAt)
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEditSave = async () => {
    setIsSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/pitchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactUuid: editUuid,
          firstName: editFirstName,
          lastName: editLastName,
          email: editEmail,
          tld: editTld,
          publication: editPublication,
          phone: editPhone,
          notes: editNotes,
          unsubscribed: editUnsubscribed,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update contact')
      }

      setShowEditModal(false)
      setSuccess('Contact updated.')
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // Delete contact
  const openDelete = (c: Contact) => {
    setDeleteContact(c)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteContact) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/company/${companyUuid}/pitchlist`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUuid: deleteContact.uuid }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove contact')
      }

      setShowDeleteModal(false)
      setDeleteContact(null)
      setSuccess('Contact removed.')
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
          href={`/company/${companyUuid}/pitchlist`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pitch List Settings
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
            {selected.size} contact{selected.size !== 1 ? 's' : ''} selected
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

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">
              Media Contacts ({stats.total})
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

          {contacts.length > 0 ? (
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
                      <th className="pb-2 pr-4 font-medium text-gray-500">Contact</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Publication</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Added</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => {
                      const rowStatus = getStatus(c)
                      const isSelected = c.uuid ? selected.has(c.uuid) : false
                      return (
                        <tr key={c.id} className={`border-b last:border-0 ${isSelected ? 'bg-red-50/50' : ''}`}>
                          <td className="py-2 pr-2">
                            {c.uuid && (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(c.uuid!)}
                                aria-label={`Select ${c.email}`}
                              />
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            {(c.firstName || c.lastName) && (
                              <>
                                <span className="font-medium text-gray-900">
                                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                                </span>
                                <br />
                              </>
                            )}
                            <span className="text-gray-500">{c.email}</span>
                          </td>
                          <td className="py-2 pr-4 text-gray-600">
                            {c.publication || c.tld || '—'}
                          </td>
                          <td className="py-2 pr-4 text-gray-600">{formatDate(c.createdAt)}</td>
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
                                onClick={() => openView(c)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="View contact"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEdit(c)}
                                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit contact"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDelete(c)}
                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                title="Remove contact"
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
                ? 'No contacts match the current filters.'
                : 'No contacts yet. Add contacts from the pitch list settings page.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* View Contact Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>
              Media contact information and activity.
            </DialogDescription>
          </DialogHeader>

          {viewContact && (
            <div className="space-y-4 py-2">
              {/* Name & Email */}
              <div className="space-y-2">
                {(viewContact.firstName || viewContact.lastName) && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                    <p className="text-sm text-gray-900">
                      {[viewContact.firstName, viewContact.lastName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                  <p className="text-sm text-gray-900">{viewContact.email}</p>
                </div>
              </div>

              {/* Publication */}
              {(viewContact.publication || viewContact.tld) && (
                <div className="grid grid-cols-2 gap-4">
                  {viewContact.publication && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Publication</p>
                      <p className="text-sm text-gray-900">{viewContact.publication}</p>
                    </div>
                  )}
                  {viewContact.tld && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">Domain</p>
                      <p className="text-sm text-gray-900">{viewContact.tld}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Phone */}
              {viewContact.phone && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Phone</p>
                  <p className="text-sm text-gray-900">{viewContact.phone}</p>
                </div>
              )}

              {/* Notes */}
              {viewContact.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Notes</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{viewContact.notes}</p>
                </div>
              )}

              {/* Social Profiles */}
              {(viewContact.linkedin || viewContact.twitter || viewContact.facebook || viewContact.instagram || viewContact.crunchbase || viewContact.youtube) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Social Profiles</p>
                  <div className="flex flex-wrap gap-2">
                    {viewContact.linkedin && (
                      <a href={viewContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        LinkedIn
                      </a>
                    )}
                    {viewContact.twitter && (
                      <a href={viewContact.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        Twitter
                      </a>
                    )}
                    {viewContact.facebook && (
                      <a href={viewContact.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        Facebook
                      </a>
                    )}
                    {viewContact.instagram && (
                      <a href={viewContact.instagram} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        Instagram
                      </a>
                    )}
                    {viewContact.crunchbase && (
                      <a href={viewContact.crunchbase} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        Crunchbase
                      </a>
                    )}
                    {viewContact.youtube && (
                      <a href={viewContact.youtube} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded">
                        YouTube
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Activity & Status */}
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">Activity</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Added:</span>{' '}
                    <span className="text-gray-900">{formatDate(viewContact.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Source:</span>{' '}
                    <span className="text-gray-900 capitalize">{viewContact.source || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Open:</span>{' '}
                    <span className="text-gray-900">{formatDate(viewContact.lastOpenAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Emails Sent:</span>{' '}
                    <span className="text-gray-900">{viewContact.emailCount ?? 0}</span>
                  </div>
                  {viewContact.bouncedAt && (
                    <div>
                      <span className="text-gray-500">Bounced:</span>{' '}
                      <span className="text-red-600">{formatDate(viewContact.bouncedAt)}</span>
                    </div>
                  )}
                  {viewContact.unsubscribeAt && (
                    <div>
                      <span className="text-gray-500">Unsubscribed:</span>{' '}
                      <span className="text-amber-600">{formatDate(viewContact.unsubscribeAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 uppercase">Status:</span>
                {(() => {
                  const s = getStatus(viewContact)
                  if (s === 'active') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                  if (s === 'bounced') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Bounced</span>
                  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Unsubscribed</span>
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            {viewContact && (
              <Button onClick={() => { setShowViewModal(false); openEdit(viewContact) }}>
                <Pencil className="h-4 w-4" />
                Edit Contact
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {selected.size} Contact{selected.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the selected contacts from your pitch list? This cannot be undone.
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
              Remove {selected.size} Contact{selected.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update this contact&apos;s details.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{editError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
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
                <Label htmlFor="edit-tld">Publication Domain *</Label>
                <Input
                  id="edit-tld"
                  value={editTld}
                  onChange={(e) => setEditTld(e.target.value)}
                  placeholder="e.g. techcrunch.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-publication">Publication Name</Label>
                <Input
                  id="edit-publication"
                  value={editPublication}
                  onChange={(e) => setEditPublication(e.target.value)}
                  placeholder="e.g. TechCrunch"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-notes">Internal Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
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
            <DialogTitle>Remove Contact</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this contact from your pitch list?
            </DialogDescription>
          </DialogHeader>

          {deleteContact && (
            <div className="py-2">
              <p className="text-sm font-medium text-gray-900">
                {[deleteContact.firstName, deleteContact.lastName].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-gray-500">{deleteContact.email}</p>
              {deleteContact.publication && (
                <p className="text-sm text-gray-400">{deleteContact.publication}</p>
              )}
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
              Remove Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
