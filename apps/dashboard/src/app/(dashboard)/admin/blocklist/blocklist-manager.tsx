'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Plus, Trash2 } from 'lucide-react'

interface BlocklistTerm {
  id: number
  term: string
  note: string | null
  createdBy: number | null
  createdAt: string | Date
}

function formatCreatedAt(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function BlocklistManager({
  initialTerms,
}: {
  initialTerms: BlocklistTerm[]
}) {
  const [terms, setTerms] = useState(initialTerms)
  const [term, setTerm] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const filtered = terms.filter((t) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      t.term.toLowerCase().includes(q) ||
      (t.note || '').toLowerCase().includes(q)
    )
  })

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, note }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add term')
      }
      setTerms((prev) =>
        [...prev, data].sort((a, b) =>
          a.term.localeCompare(b.term, undefined, { sensitivity: 'base' }),
        ),
      )
      setTerm('')
      setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add term')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/blocklist/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete term')
      }
      setTerms((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete term')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add to block list</CardTitle>
          <CardDescription>
            Keywords and phrases stored for future filtering. Nothing uses this
            list yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="blocklist-term">Keyword or phrase</Label>
                <Input
                  id="blocklist-term"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="e.g. guaranteed results"
                  maxLength={500}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="blocklist-note">Note (optional)</Label>
                <Input
                  id="blocklist-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why it’s blocked"
                  maxLength={256}
                />
              </div>
              <Button type="submit" disabled={saving || !term.trim()} className="cursor-pointer">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </>
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Block list</CardTitle>
              <CardDescription>
                {terms.length} term{terms.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            {terms.length > 0 && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search list…"
                className="max-w-xs"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {terms.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              No keywords or phrases yet.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
              No matches for “{search}”.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                      Term
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                      Note
                    </th>
                    <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                      Added
                    </th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                    >
                      <td className="py-2.5 pr-4 font-medium text-gray-900 dark:text-gray-100">
                        {item.term}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400">
                        {item.note || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatCreatedAt(item.createdAt)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-gray-500 hover:text-red-600 cursor-pointer"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
