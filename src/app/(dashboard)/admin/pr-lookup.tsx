'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileText, User, Building2, ExternalLink, Pencil } from 'lucide-react'

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
}

function extractPrId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/news\/\d{8}(\d+)/)
  if (urlMatch) return urlMatch[1]
  return trimmed
}

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  review: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  hold: 'bg-amber-100 text-amber-800',
  draft: 'bg-gray-100 text-gray-800',
  draftnxt: 'bg-gray-100 text-gray-800',
  start: 'bg-gray-100 text-gray-800',
}

const statusLabels: Record<string, string> = {
  sent: 'Published',
  review: 'In Review',
  approved: 'Approved',
  hold: 'On Hold',
  draft: 'Draft',
  draftnxt: 'Draft',
  start: 'Draft',
}

export function PRLookup() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const resolvedId = extractPrId(input)
    if (!resolvedId || !/^\d+$/.test(resolvedId)) {
      setError('Could not extract a valid PR ID from the input.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch(`/api/admin/lookup?prId=${resolvedId}`)
      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Not found')
      }
    } catch {
      setError('Failed to look up press release')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-400" />
          PR Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleLookup} className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Paste a newsworthy.ai URL or enter a PR ID..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="bg-cyan-800 text-white hover:bg-cyan-900"
            disabled={loading || !input.trim()}
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {result && (
          <div className="space-y-3 pt-2">
            {/* Release Info */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.release.title || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">ID: {result.release.id}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[result.release.status] || 'bg-gray-100 text-gray-800'}`}>
                        {statusLabels[result.release.status] || result.release.status}
                      </span>
                      {result.release.distribution && (
                        <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">
                          {result.release.distribution}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      {result.release.createdAt && (
                        <span>Created: {new Date(result.release.createdAt).toLocaleDateString()}</span>
                      )}
                      {result.release.releasedAt && (
                        <span>Released: {new Date(result.release.releasedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/editorial/edit/${result.release.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  </Link>
                  {result.release.status === 'sent' && result.release.releaseAt && result.release.slug && (
                    <a
                      href={`https://www.newsworthy.ai/news/${new Date(result.release.releaseAt).getFullYear()}${String(new Date(result.release.releaseAt).getMonth() + 1).padStart(2, '0')}${String(new Date(result.release.releaseAt).getDate()).padStart(2, '0')}${result.release.id}/${result.release.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3" />
                        View Live
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* User Info */}
            {result.user && (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-blue-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {result.user.firstName || result.user.lastName
                          ? [result.user.firstName, result.user.lastName].filter(Boolean).join(' ')
                          : result.user.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        {result.user.firstName || result.user.lastName ? result.user.email : `User ID: ${result.user.id}`}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {result.user.isAdmin && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-medium">Admin</span>}
                        {result.user.isEditor && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">Editor</span>}
                        {result.user.isStaff && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">Staff</span>}
                      </div>
                    </div>
                  </div>
                  <Link href={`/admin/users/${result.user.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <User className="h-3 w-3" />
                      View User
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Brand Info */}
            {result.brand && (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {result.brand.logoUrl ? (
                      <img
                        src={result.brand.logoUrl.includes('RESIZE') ? result.brand.logoUrl.replace('RESIZE', 'resize=width:200') : result.brand.logoUrl}
                        alt={result.brand.companyName}
                        className="h-9 w-9 rounded-lg object-contain bg-gray-50 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-purple-700" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{result.brand.companyName}</p>
                      <p className="text-xs text-gray-500">Brand ID: {result.brand.id}</p>
                    </div>
                  </div>
                  <Link href={`/admin/brands/${result.brand.uuid}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Building2 className="h-3 w-3" />
                      View Brand
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
