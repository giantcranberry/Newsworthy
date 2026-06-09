'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Share2, ExternalLink, Copy, Check, Trash2 } from 'lucide-react'

interface Share {
  uuid: string
  title: string | null
  count: number
  createdAt: string | null
}

export function SharedReportsList({ shares }: { shares: Share[] }) {
  const [rows, setRows] = useState(shares)
  const [copied, setCopied] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const publicUrl = (uuid: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/pr/clipsreport/consolidated/${uuid}` : ''

  const copy = async (uuid: string) => {
    try {
      await navigator.clipboard.writeText(publicUrl(uuid))
      setCopied(uuid)
      setTimeout(() => setCopied((c) => (c === uuid ? null : c)), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const revoke = async (uuid: string) => {
    if (!confirm('Revoke this shared report? The public link will stop working.')) return
    setRevoking(uuid)
    try {
      const res = await fetch(`/api/pr/reports/consolidated/share/${uuid}`, { method: 'DELETE' })
      if (res.ok) setRows((prev) => prev.filter((r) => r.uuid !== uuid))
    } finally {
      setRevoking(null)
    }
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Share2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">No Shared Reports Yet</h3>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Select releases on the Reports page, build a consolidated report, then create a shareable link.
          </p>
          <Link href="/pr/reports">
            <Button className="mt-6 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer">
              Go to Reports
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
        <thead className="bg-gray-50 dark:bg-gray-950">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Releases
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
          {rows.map((r) => (
            <tr key={r.uuid} className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">
              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                {r.title || <span className="text-gray-400 italic">Untitled</span>}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{r.count}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                {r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={() => copy(r.uuid)}>
                    {copied === r.uuid ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === r.uuid ? 'Copied' : 'Copy link'}
                  </Button>
                  <a href={publicUrl(r.uuid)} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={revoking === r.uuid}
                    onClick={() => revoke(r.uuid)}
                    className="gap-1.5 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Revoke
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
