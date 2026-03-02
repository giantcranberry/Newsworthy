'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface ReleaseRow {
  release: {
    id: number
    uuid: string
    title: string | null
    status: string | null
    createdAt: Date | null
    releaseAt: Date | null
  }
  user: {
    email: string
  } | null
  company: {
    companyName: string | null
  } | null
}

const statusColors: Record<string, string> = {
  start: 'bg-gray-100 text-gray-700',
  draft: 'bg-yellow-100 text-yellow-700',
  review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  sent: 'bg-emerald-100 text-emerald-700',
  released: 'bg-purple-100 text-purple-700',
}

const ALL_STATUSES = ['start', 'draft', 'review', 'approved', 'sent', 'released']

type SortField = 'createdAt' | 'releaseAt'
type SortDir = 'desc' | 'asc'

export function ReleasesTable({ releases }: { releases: ReleaseRow[] }) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

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

  const filtered = useMemo(() => {
    let result = releases
    if (statusFilter !== 'all') {
      result = result.filter(r => (r.release.status || 'start') === statusFilter)
    }
    result = [...result].sort((a, b) => {
      const aVal = a.release[sortField] ? new Date(a.release[sortField]!).getTime() : 0
      const bVal = b.release[sortField] ? new Date(b.release[sortField]!).getTime() : 0
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
    return result
  }, [releases, statusFilter, sortField, sortDir])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Press Releases ({filtered.length})</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Status:</span>
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {ALL_STATUSES.map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
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
                <th className="py-3 px-4 font-medium text-gray-500">ID</th>
                <th className="py-3 px-4 font-medium text-gray-500">Title</th>
                <th className="py-3 px-4 font-medium text-gray-500">Company</th>
                <th className="py-3 px-4 font-medium text-gray-500">Author</th>
                <th className="py-3 px-4 font-medium text-gray-500">Status</th>
                <th className="py-3 px-4 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('createdAt')}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Created <SortIcon field="createdAt" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium text-gray-500">
                  <button
                    onClick={() => toggleSort('releaseAt')}
                    className="flex items-center gap-1 hover:text-gray-900"
                  >
                    Release Date <SortIcon field="releaseAt" />
                  </button>
                </th>
                <th className="py-3 px-4 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ release, user, company: comp }) => (
                <tr key={release.id} className="border-b hover:bg-gray-50">
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
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {release.createdAt ? new Date(release.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
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
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500">
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
