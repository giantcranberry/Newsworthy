'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, ArrowUpDown, ArrowUp, ArrowDown, Loader2, Settings, FileText, User, Building2, ExternalLink, Pencil, BarChart3, ArrowUpCircle, LinkIcon, X } from 'lucide-react'

interface ReleaseRow {
  release: {
    id: number
    uuid: string
    title: string | null
    status: string | null
    createdAt: Date | string | null
    releaseAt: Date | string | null
  }
  user: {
    email: string
  } | null
  company: {
    companyName: string | null
  } | null
}

interface LookupResult {
  release: {
    id: number
    uuid: string
    title: string | null
    status: string
    distribution: string | null
    createdAt: string | null
    releaseAt: string | null
    releasedAt: string | null
    slug: string | null
  }
  user: {
    id: number
    email: string
    firstName: string | null
    lastName: string | null
    isAdmin: boolean | null
    isEditor: boolean | null
    isStaff: boolean | null
  } | null
  brand: {
    id: number
    uuid: string
    companyName: string
    logoUrl: string | null
  } | null
  reportUrl: string | null
}

const distributionOptions = [
  { value: 'standard', label: 'Standard', color: 'bg-gray-500' },
  { value: 'enhanced', label: 'Enhanced', color: 'bg-blue-900' },
  { value: 'yahoo', label: 'Yahoo', color: 'bg-purple-700' },
]

const statusColors: Record<string, string> = {
  start: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  draft: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  draftnxt: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  review: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  approved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  sent: 'bg-emerald-100 text-emerald-700',
}

const statusLabels: Record<string, string> = {
  start: 'start',
  draft: 'draft',
  draftnxt: 'draftnxt',
  review: 'review',
  approved: 'approved',
  sent: 'sent',
}

const ALL_STATUSES = ['start', 'draft', 'draftnxt', 'review', 'approved', 'sent']

type SortField = 'createdAt' | 'releaseAt'
type SortDir = 'desc' | 'asc'

export function ReleasesTable({ initialReleases, isAdmin = false }: { initialReleases: ReleaseRow[]; isAdmin?: boolean }) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [displayedReleases, setDisplayedReleases] = useState<ReleaseRow[]>(initialReleases)
  const [isLoading, setIsLoading] = useState(false)
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Expandable detail panel state
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [upgradeTarget, setUpgradeTarget] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState('')
  const [reportUrlInput, setReportUrlInput] = useState('')
  const [savingReportUrl, setSavingReportUrl] = useState(false)
  const [reportUrlMessage, setReportUrlMessage] = useState('')
  const [lookupError, setLookupError] = useState('')

  const handleExpand = async (releaseId: number) => {
    if (expandedId === releaseId) {
      setExpandedId(null)
      setLookupResult(null)
      return
    }

    setExpandedId(releaseId)
    setLookupResult(null)
    setLookupLoading(true)
    setLookupError('')
    setUpgradeTarget('')
    setUpgradeSuccess('')
    setReportUrlInput('')
    setReportUrlMessage('')

    try {
      const res = await fetch(`/api/admin/lookup?prId=${releaseId}`)
      const data = await res.json()
      if (res.ok) {
        setLookupResult(data)
      } else {
        setLookupError(data.error || 'Failed to load details')
      }
    } catch {
      setLookupError('Failed to load details')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!lookupResult || !upgradeTarget) return
    setUpgrading(true)
    setUpgradeSuccess('')

    try {
      const res = await fetch('/api/admin/lookup/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: lookupResult.release.id,
          distribution: upgradeTarget,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setLookupResult({
          ...lookupResult,
          release: { ...lookupResult.release, distribution: data.distribution },
        })
        setUpgradeSuccess(`Distribution updated to ${data.distribution}`)
        setUpgradeTarget('')
      } else {
        setLookupError(data.error || 'Failed to upgrade')
      }
    } catch {
      setLookupError('Failed to upgrade distribution')
    } finally {
      setUpgrading(false)
    }
  }

  const handleSaveReportUrl = async () => {
    if (!lookupResult || !reportUrlInput.trim()) return
    setSavingReportUrl(true)
    setReportUrlMessage('')

    try {
      const res = await fetch('/api/editorial/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: lookupResult.release.id,
          reportUrl: reportUrlInput.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setLookupResult({ ...lookupResult, reportUrl: reportUrlInput.trim() })
        setReportUrlMessage('Report URL saved')
        setReportUrlInput('')
      } else {
        setReportUrlMessage(data.error || 'Failed to save URL')
      }
    } catch {
      setReportUrlMessage('Failed to save URL')
    } finally {
      setSavingReportUrl(false)
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
    return sortDir === 'desc'
      ? <ArrowDown className="h-3.5 w-3.5" />
      : <ArrowUp className="h-3.5 w-3.5" />
  }

  const handleStatusFilter = useCallback(async (status: string) => {
    setStatusFilter(status)

    if (status === 'all') {
      setDisplayedReleases(initialReleases)
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/releases?status=${status}`)
      if (res.ok) {
        const data = await res.json()
        setDisplayedReleases(data)
      }
    } finally {
      setIsLoading(false)
    }
  }, [initialReleases])

  const sorted = useMemo(() => {
    return [...displayedReleases].sort((a, b) => {
      const aVal = a.release[sortField] ? new Date(a.release[sortField]!).getTime() : 0
      const bVal = b.release[sortField] ? new Date(b.release[sortField]!).getTime() : 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [displayedReleases, sortField, sortDir])

  const countLabel = statusFilter === 'all'
    ? `${sorted.length} — Last 30 days`
    : `${sorted.length} ${statusFilter}`

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            Press Releases ({countLabel})
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500 dark:text-gray-400">Status:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => handleStatusFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 dark:bg-gray-700'
                }`}
              >
                All
              </button>
              {ALL_STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-gray-900 text-white'
                      : statusColors[status] + ' hover:opacity-80'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left">
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">ID</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Title</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Company</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Author</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Created</th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">
                  <button
                    onClick={() => toggleSort('releaseAt')}
                    className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100"
                  >
                    Release <SortIcon field="releaseAt" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ release, user, company: comp }) => (
                <React.Fragment key={release.id}>
                <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">
                  <td className="py-3 px-4 text-sm">{release.id}</td>
                  <td className="py-3 px-4 text-sm max-w-xs truncate">
                    {release.title || 'Untitled'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {comp?.companyName || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {user?.email || 'N/A'}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[release.status || 'start'] || statusColors.start}`}>
                      {release.status || 'start'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    {release.createdAt ? new Date(release.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-400">
                    {release.releaseAt ? new Date(release.releaseAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
                      <Link href={`/pr/${release.uuid}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {release.status === 'review' && (
                        <Link href={`/editorial/review/${release.uuid}`}>
                          <Button size="sm">Review</Button>
                        </Link>
                      )}
                      <Button
                        variant={expandedId === release.id ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleExpand(release.id)}
                        className={expandedId === release.id ? 'bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700' : ''}
                      >
                        {expandedId === release.id ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedId === release.id && (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 bg-gray-50 dark:bg-gray-950 border-b">
                      {lookupLoading && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading details...
                        </div>
                      )}
                      {lookupError && (
                        <p className="text-sm text-red-600 dark:text-red-400">{lookupError}</p>
                      )}
                      {lookupResult && (
                        <div className="space-y-3 max-w-3xl">
                          {/* Release detail summary */}
                          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <FileText className="h-4 w-4 text-green-700 dark:text-green-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {lookupResult.release.title || 'Untitled'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">ID: {lookupResult.release.id}</span>
                                    {lookupResult.release.distribution && (
                                      <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700">
                                        {lookupResult.release.distribution}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {lookupResult.release.createdAt && (
                                      <span>Created: {new Date(lookupResult.release.createdAt).toLocaleDateString()}</span>
                                    )}
                                    {lookupResult.release.releasedAt && (
                                      <span>Released: {new Date(lookupResult.release.releasedAt).toLocaleDateString()}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Link href={`/editorial/edit/${lookupResult.release.id}`}>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                    <Pencil className="h-3 w-3" /> Edit
                                  </Button>
                                </Link>
                                {lookupResult.release.status === 'sent' && lookupResult.release.releasedAt &&
                                  Date.now() - new Date(lookupResult.release.releasedAt).getTime() > 24 * 60 * 60 * 1000 && (
                                  <Link href={`/pr/clips/${lookupResult.release.uuid}`}>
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                      <BarChart3 className="h-3 w-3" /> View Report
                                    </Button>
                                  </Link>
                                )}
                                {lookupResult.release.status === 'sent' && lookupResult.release.releaseAt && lookupResult.release.slug && (
                                  <a
                                    href={`https://www.newsworthy.ai/news/${new Date(lookupResult.release.releaseAt).getFullYear()}${String(new Date(lookupResult.release.releaseAt).getMonth() + 1).padStart(2, '0')}${String(new Date(lookupResult.release.releaseAt).getDate()).padStart(2, '0')}${lookupResult.release.id}/${lookupResult.release.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                      <ExternalLink className="h-3 w-3" /> View Live
                                    </Button>
                                  </a>
                                )}
                                {lookupResult.release.status === 'sent' && (
                                  <Link href={`/pr/clips/${lookupResult.release.uuid}`}>
                                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                      <BarChart3 className="h-3 w-3" /> Clipping Report
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* User Info */}
                          {lookupResult.user && (
                            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                    <User className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                      {lookupResult.user.firstName || lookupResult.user.lastName
                                        ? [lookupResult.user.firstName, lookupResult.user.lastName].filter(Boolean).join(' ')
                                        : lookupResult.user.email}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {lookupResult.user.firstName || lookupResult.user.lastName ? lookupResult.user.email : `User ID: ${lookupResult.user.id}`}
                                    </p>
                                    <div className="flex gap-1 mt-1">
                                      {lookupResult.user.isAdmin && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[10px] font-medium">Admin</span>}
                                      {lookupResult.user.isEditor && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium">Editor</span>}
                                      {lookupResult.user.isStaff && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-[10px] font-medium">Staff</span>}
                                    </div>
                                  </div>
                                </div>
                                <Link href={`/admin/users/${lookupResult.user.id}`}>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                    <User className="h-3 w-3" /> View User
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}

                          {/* Brand Info */}
                          {lookupResult.brand && (
                            <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  {lookupResult.brand.logoUrl ? (
                                    <img
                                      src={lookupResult.brand.logoUrl.includes('RESIZE') ? lookupResult.brand.logoUrl.replace('RESIZE', 'resize=width:200') : lookupResult.brand.logoUrl}
                                      alt={lookupResult.brand.companyName}
                                      className="h-9 w-9 rounded-lg object-contain bg-gray-50 dark:bg-gray-950 flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                                      <Building2 className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{lookupResult.brand.companyName}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Brand ID: {lookupResult.brand.id}</p>
                                  </div>
                                </div>
                                <Link href={`/admin/brands/${lookupResult.brand.uuid}`}>
                                  <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                                    <Building2 className="h-3 w-3" /> View Brand
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}

                          {/* Distribution Upgrade - Admin Only */}
                          {isAdmin && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <ArrowUpCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-amber-900">Change Distribution</p>
                                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                    Current: <span className="font-medium">{lookupResult.release.distribution || 'none'}</span>
                                  </p>
                                  <div className="flex items-center gap-2 mt-2">
                                    <SelectRoot value={upgradeTarget} onValueChange={setUpgradeTarget}>
                                      <SelectTrigger className="w-48 h-8 text-xs bg-white dark:bg-gray-900">
                                        <SelectValue placeholder="Select distribution" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {distributionOptions
                                          .filter(opt => opt.value !== lookupResult.release.distribution)
                                          .map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                              <span className="flex items-center gap-2">
                                                <span className={`inline-block h-2 w-2 rounded-full ${opt.color}`} />
                                                {opt.label}
                                              </span>
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </SelectRoot>
                                    <Button
                                      size="sm"
                                      className="h-8 bg-amber-700 text-white hover:bg-amber-800 text-xs"
                                      disabled={!upgradeTarget || upgrading}
                                      onClick={handleUpgrade}
                                    >
                                      {upgrading ? 'Updating...' : 'Update'}
                                    </Button>
                                  </div>
                                  {upgradeSuccess && (
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-2 font-medium">{upgradeSuccess}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Report URL - shown for enhanced/yahoo distributions */}
                          {isAdmin && ['enhanced', 'yahoo'].includes(lookupResult.release.distribution || '') && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                              <div className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <LinkIcon className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-blue-900">Report URL</p>
                                  {lookupResult.reportUrl ? (
                                    <div className="mt-1">
                                      <a
                                        href={lookupResult.reportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-700 dark:text-blue-400 underline break-all"
                                      >
                                        {lookupResult.reportUrl}
                                      </a>
                                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 mb-1">Replace with a new URL:</p>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 mb-1">No report URL set</p>
                                  )}
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="url"
                                      placeholder="Enter report URL"
                                      value={reportUrlInput}
                                      onChange={(e) => setReportUrlInput(e.target.value)}
                                      className="flex-1 h-8 text-xs bg-white dark:bg-gray-900"
                                    />
                                    <Button
                                      size="sm"
                                      className="h-8 bg-blue-700 text-white hover:bg-blue-800 text-xs"
                                      disabled={savingReportUrl || !reportUrlInput.trim()}
                                      onClick={handleSaveReportUrl}
                                    >
                                      {savingReportUrl ? 'Saving...' : lookupResult.reportUrl ? 'Replace' : 'Save'}
                                    </Button>
                                  </div>
                                  {reportUrlMessage && (
                                    <p className={`text-xs mt-2 font-medium ${reportUrlMessage.includes('saved') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                      {reportUrlMessage}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No releases found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
