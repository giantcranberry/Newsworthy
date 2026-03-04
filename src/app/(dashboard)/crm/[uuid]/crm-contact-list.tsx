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
  Search,
  X,
  Eye,
  Newspaper,
  Heart,
  Plus,
  Download,
} from 'lucide-react'

interface CrmContact {
  id: number
  uuid: string | null
  contactType: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
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

interface CrmContactListProps {
  readOnly?: boolean
  companyUuid: string
  contacts: CrmContact[]
  stats: {
    total: number
    active: number
    bounced: number
    unsubscribed: number
    media: number
    advocates: number
  }
  filtered: number
  currentPage: number
  totalPages: number
  perPage: number
  query: string
  status: string
  contactType: string
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

function getStatus(c: CrmContact) {
  if (c.bouncedAt) return 'bounced'
  if (c.unsubscribeAt) return 'unsubscribed'
  return 'active'
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'media') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
        Media
      </span>
    )
  }
  if (type === 'advocate') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        Advocate
      </span>
    )
  }
  if (type === 'both') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
        Both
      </span>
    )
  }
  return null
}

export function CrmContactList({
  readOnly,
  companyUuid,
  contacts,
  stats,
  filtered,
  currentPage,
  totalPages,
  perPage,
  query,
  status,
  contactType,
}: CrmContactListProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState(query)

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Bulk delete state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // View state
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewContact, setViewContact] = useState<CrmContact | null>(null)

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
  const [editContactType, setEditContactType] = useState('media')
  const [editUnsubscribed, setEditUnsubscribed] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Add state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addFirstName, setAddFirstName] = useState('')
  const [addLastName, setAddLastName] = useState('')
  const [addTld, setAddTld] = useState('')
  const [addPublication, setAddPublication] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addContactType, setAddContactType] = useState('media')
  const [isSavingAdd, setIsSavingAdd] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteContact, setDeleteContact] = useState<CrmContact | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Clear selection when page/filters change
  useEffect(() => {
    setSelected(new Set())
  }, [currentPage, query, status, perPage, contactType])

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

  const handleTypeFilter = (value: string) => {
    router.push(buildUrl({ type: contactType === value ? undefined : value, page: '1' }))
  }

  // Add contact
  const handleAdd = async () => {
    setIsSavingAdd(true)
    setAddError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/crm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'single',
          email: addEmail,
          firstName: addFirstName,
          lastName: addLastName,
          tld: addTld,
          publication: addPublication,
          phone: addPhone,
          notes: addNotes,
          contactType: addContactType,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add contact')
      }

      setShowAddModal(false)
      setAddEmail('')
      setAddFirstName('')
      setAddLastName('')
      setAddTld('')
      setAddPublication('')
      setAddPhone('')
      setAddNotes('')
      setAddContactType('media')
      setSuccess('Contact added.')
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setIsSavingAdd(false)
    }
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/crm`, {
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
  const openView = (c: CrmContact) => {
    setViewContact(c)
    setShowViewModal(true)
  }

  // Edit contact
  const openEdit = (c: CrmContact) => {
    setEditUuid(c.uuid)
    setEditEmail(c.email || '')
    setEditFirstName(c.firstName || '')
    setEditLastName(c.lastName || '')
    setEditTld(c.tld || '')
    setEditPublication(c.publication || '')
    setEditPhone(c.phone || '')
    setEditNotes(c.notes || '')
    setEditContactType(c.contactType || 'media')
    setEditUnsubscribed(!!c.unsubscribeAt)
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEditSave = async () => {
    setIsSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/crm`, {
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
          contactType: editContactType,
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
  const openDelete = (c: CrmContact) => {
    setDeleteContact(c)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteContact) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/company/${companyUuid}/crm`, {
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

  // Export contacts as CSV
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (contactType) params.set('type', contactType)
      if (status) params.set('status', status)
      const qs = params.toString()
      const url = `/api/company/${companyUuid}/crm/export${qs ? `?${qs}` : ''}`

      const response = await fetch(url)
      if (!response.ok) throw new Error('Export failed')

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'crm-export.csv'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      setError('Failed to export contacts')
    } finally {
      setIsExporting(false)
    }
  }

  const startRecord = (currentPage - 1) * perPage + 1
  const endRecord = Math.min(currentPage * perPage, filtered)

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">{success}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${!status ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}
          onClick={() => handleStatusFilter(status || '')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <Users className="h-5 w-5 text-gray-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'active' ? 'ring-2 ring-green-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}
          onClick={() => handleStatusFilter('active')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <UserCheck className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'bounced' ? 'ring-2 ring-red-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}
          onClick={() => handleStatusFilter('bounced')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <MailX className="h-5 w-5 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.bounced}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bounced</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${status === 'unsubscribed' ? 'ring-2 ring-amber-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}
          onClick={() => handleStatusFilter('unsubscribed')}
        >
          <CardContent className="pt-4 pb-4 text-center">
            <UserX className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.unsubscribed}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Unsubscribed</p>
          </CardContent>
        </Card>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleTypeFilter(contactType || '')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            !contactType
              ? 'bg-gray-900 text-white dark:bg-gray-200 dark:text-gray-900'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All ({stats.total})
        </button>
        <button
          onClick={() => handleTypeFilter('media')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            contactType === 'media'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Newspaper className="h-3.5 w-3.5 inline mr-1" />
          Media ({stats.media})
        </button>
        <button
          onClick={() => handleTypeFilter('advocate')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            contactType === 'advocate'
              ? 'bg-green-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <Heart className="h-3.5 w-3.5 inline mr-1" />
          Advocates ({stats.advocates})
        </button>
      </div>

      {/* Bulk action bar */}
      {!readOnly && someSelected && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-red-800 dark:text-red-400">
            {selected.size} contact{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Clear Selection
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteModal(true)}>
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
              Contacts ({filtered})
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search email, name, publication..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 pr-8 h-9"
                />
                {searchInput && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting || filtered === 0}
                className="gap-1"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export
              </Button>
              {!readOnly && (
                <Button size="sm" onClick={() => setShowAddModal(true)} className="gap-1">
                  <Plus className="h-4 w-4" />
                  Add Contact
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(query || status || contactType) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Showing {filtered} result{filtered !== 1 ? 's' : ''}
              {status && <> with status <span className="font-medium capitalize">{status}</span></>}
              {contactType && <> of type <span className="font-medium capitalize">{contactType}</span></>}
              {query && <> matching &ldquo;{query}&rdquo;</>}
            </p>
          )}

          {contacts.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-left">
                      {!readOnly && (
                        <th className="pb-2 pr-2 w-8">
                          <Checkbox
                            checked={allOnPageSelected}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Select all on this page"
                          />
                        </th>
                      )}
                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Contact</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Type</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Publication</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Added</th>
                      <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                      <th className="pb-2 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c) => {
                      const rowStatus = getStatus(c)
                      const isSelected = c.uuid ? selected.has(c.uuid) : false
                      return (
                        <tr key={c.id} className={`border-b border-gray-200 dark:border-gray-800 last:border-0 ${isSelected ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                          {!readOnly && (
                            <td className="py-2 pr-2">
                              {c.uuid && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(c.uuid!)}
                                  aria-label={`Select ${c.email}`}
                                />
                              )}
                            </td>
                          )}
                          <td className="py-2 pr-4">
                            {(c.firstName || c.lastName) && (
                              <>
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                  {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                                </span>
                                <br />
                              </>
                            )}
                            <span className="text-gray-500 dark:text-gray-400">{c.email}</span>
                          </td>
                          <td className="py-2 pr-4">
                            <TypeBadge type={c.contactType} />
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                            {c.publication || c.tld || '—'}
                          </td>
                          <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{formatDate(c.createdAt)}</td>
                          <td className="py-2 pr-4">
                            {rowStatus === 'active' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                Active
                              </span>
                            )}
                            {rowStatus === 'bounced' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                Bounced
                              </span>
                            )}
                            {rowStatus === 'unsubscribed' && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                Unsubscribed
                              </span>
                            )}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openView(c)}
                                className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                title="View contact"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {!readOnly && (
                                <button
                                  onClick={() => openEdit(c)}
                                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                  title="Edit contact"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}
                              {!readOnly && (
                                <button
                                  onClick={() => openDelete(c)}
                                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                                  title="Remove contact"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Rows per page:</span>
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
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {filtered > 0 ? `${startRecord}–${endRecord} of ${filtered}` : '0 results'}
                  </span>
                  <div className="flex items-center gap-1">
                    {currentPage > 1 ? (
                      <Link
                        href={buildUrl({ page: String(currentPage - 1) })}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-300 dark:text-gray-600">
                        <ChevronLeft className="h-4 w-4" />
                      </span>
                    )}

                    {currentPage < totalPages ? (
                      <Link
                        href={buildUrl({ page: String(currentPage + 1) })}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded text-gray-300 dark:text-gray-600">
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              {query || status || contactType
                ? 'No contacts match the current filters.'
                : 'No contacts yet. Add a contact or import contacts to get started.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* View Contact Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Contact Details</DialogTitle>
            <DialogDescription>Contact information and activity.</DialogDescription>
          </DialogHeader>

          {viewContact && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <TypeBadge type={viewContact.contactType} />
              </div>

              <div className="space-y-2">
                {(viewContact.firstName || viewContact.lastName) && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      {[viewContact.firstName, viewContact.lastName].filter(Boolean).join(' ')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{viewContact.email}</p>
                </div>
              </div>

              {(viewContact.publication || viewContact.tld) && (
                <div className="grid grid-cols-2 gap-4">
                  {viewContact.publication && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Publication</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{viewContact.publication}</p>
                    </div>
                  )}
                  {viewContact.tld && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Domain</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{viewContact.tld}</p>
                    </div>
                  )}
                </div>
              )}

              {viewContact.phone && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Phone</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{viewContact.phone}</p>
                </div>
              )}

              {viewContact.notes && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{viewContact.notes}</p>
                </div>
              )}

              {(viewContact.linkedin || viewContact.twitter || viewContact.facebook || viewContact.instagram || viewContact.crunchbase || viewContact.youtube) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Social Profiles</p>
                  <div className="flex flex-wrap gap-2">
                    {viewContact.linkedin && (
                      <a href={viewContact.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">LinkedIn</a>
                    )}
                    {viewContact.twitter && (
                      <a href={viewContact.twitter} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Twitter</a>
                    )}
                    {viewContact.facebook && (
                      <a href={viewContact.facebook} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Facebook</a>
                    )}
                    {viewContact.instagram && (
                      <a href={viewContact.instagram} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Instagram</a>
                    )}
                    {viewContact.crunchbase && (
                      <a href={viewContact.crunchbase} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">Crunchbase</a>
                    )}
                    {viewContact.youtube && (
                      <a href={viewContact.youtube} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">YouTube</a>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-800 pt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Activity</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Added:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">{formatDate(viewContact.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Source:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100 capitalize">{viewContact.source || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Last Open:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">{formatDate(viewContact.lastOpenAt)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Emails Sent:</span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">{viewContact.emailCount ?? 0}</span>
                  </div>
                  {viewContact.bouncedAt && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Bounced:</span>{' '}
                      <span className="text-red-600 dark:text-red-400">{formatDate(viewContact.bouncedAt)}</span>
                    </div>
                  )}
                  {viewContact.unsubscribeAt && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Unsubscribed:</span>{' '}
                      <span className="text-amber-600 dark:text-amber-400">{formatDate(viewContact.unsubscribeAt)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status:</span>
                {(() => {
                  const s = getStatus(viewContact)
                  if (s === 'active') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Active</span>
                  if (s === 'bounced') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Bounced</span>
                  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Unsubscribed</span>
                })()}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
            {!readOnly && viewContact && (
              <Button onClick={() => { setShowViewModal(false); openEdit(viewContact) }}>
                <Pencil className="h-4 w-4" />
                Edit Contact
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Add a new contact to your CRM.</DialogDescription>
          </DialogHeader>

          {addError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{addError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="add-contactType">Contact Type</Label>
              <Select
                id="add-contactType"
                value={addContactType}
                onChange={(e) => setAddContactType(e.target.value)}
                className="mt-1"
              >
                <option value="media">Media</option>
                <option value="advocate">Advocate</option>
                <option value="both">Both</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-firstName">First Name</Label>
                <Input
                  id="add-firstName"
                  value={addFirstName}
                  onChange={(e) => setAddFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-lastName">Last Name</Label>
                <Input
                  id="add-lastName"
                  value={addLastName}
                  onChange={(e) => setAddLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="add-email">Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="add-tld">Publication Domain</Label>
                <Input
                  id="add-tld"
                  value={addTld}
                  onChange={(e) => setAddTld(e.target.value)}
                  placeholder="e.g. techcrunch.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="add-publication">Publication Name</Label>
                <Input
                  id="add-publication"
                  value={addPublication}
                  onChange={(e) => setAddPublication(e.target.value)}
                  placeholder="e.g. TechCrunch"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="add-phone">Phone</Label>
              <Input
                id="add-phone"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="add-notes">Notes</Label>
              <Textarea
                id="add-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                rows={3}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isSavingAdd}>
              {isSavingAdd ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>Update this contact&apos;s details.</DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">{editError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="edit-contactType">Contact Type</Label>
              <Select
                id="edit-contactType"
                value={editContactType}
                onChange={(e) => setEditContactType(e.target.value)}
                className="mt-1"
              >
                <option value="media">Media</option>
                <option value="advocate">Advocate</option>
                <option value="both">Both</option>
              </Select>
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
                <Label htmlFor="edit-tld">Publication Domain</Label>
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

      {/* Bulk Delete Modal */}
      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {selected.size} Contact{selected.size !== 1 ? 's' : ''}</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove the selected contacts? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove {selected.size} Contact{selected.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Contact</DialogTitle>
            <DialogDescription>Are you sure you want to remove this contact?</DialogDescription>
          </DialogHeader>

          {deleteContact && (
            <div className="py-2">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {[deleteContact.firstName, deleteContact.lastName].filter(Boolean).join(' ')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{deleteContact.email}</p>
              <TypeBadge type={deleteContact.contactType} />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
