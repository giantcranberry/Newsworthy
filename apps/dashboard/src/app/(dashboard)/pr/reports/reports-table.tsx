'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { BarChart3, ExternalLink, Layers, X } from 'lucide-react'

export const MAX_SELECT = 12

// Stronger border + larger hit area so the checkbox reads clearly against the
// light table background (the default `border-input` token is too faint here).
const CHECKBOX_CLASS =
  'cursor-pointer size-5 border-2 border-gray-400 dark:border-gray-500 ' +
  'data-[state=checked]:bg-cyan-700 data-[state=checked]:border-cyan-700 ' +
  'dark:data-[state=checked]:bg-cyan-600 dark:data-[state=checked]:border-cyan-600'

export interface ReportRow {
  id: number
  uuid: string
  title: string | null
  companyName: string | null
  releasedAt: string | null
  ready: boolean
}

export function ReportsTable({
  rows,
  page,
  totalPages,
  brandFilter,
}: {
  rows: ReportRow[]
  page: number
  totalPages: number
  brandFilter: number | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])

  const readyRows = rows.filter((r) => r.ready)
  const atMax = selected.length >= MAX_SELECT

  const toggle = (uuid: string) => {
    setSelected((prev) =>
      prev.includes(uuid)
        ? prev.filter((u) => u !== uuid)
        : prev.length >= MAX_SELECT
          ? prev
          : [...prev, uuid],
    )
  }

  const allPageSelected =
    readyRows.length > 0 && readyRows.every((r) => selected.includes(r.uuid))

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => prev.filter((u) => !readyRows.some((r) => r.uuid === u)))
    } else {
      setSelected((prev) => {
        const next = [...prev]
        for (const r of readyRows) {
          if (next.length >= MAX_SELECT) break
          if (!next.includes(r.uuid)) next.push(r.uuid)
        }
        return next
      })
    }
  }

  const openConsolidated = () => {
    if (selected.length < 2) return
    router.push(`/pr/reports/consolidated?ids=${selected.join(',')}`)
  }

  return (
    <>
      <div
        data-tour="reports-table"
        className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
      >
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
          <thead data-tour="reports-columns" className="bg-gray-50 dark:bg-gray-950">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleAll}
                  disabled={readyRows.length === 0}
                  aria-label="Select all releases on this page"
                  className={CHECKBOX_CLASS}
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Date Released
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Press Release Title
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Reports
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
            {rows.map((r, index) => {
              const isChecked = selected.includes(r.uuid)
              return (
                <tr
                  key={r.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950"
                  {...(index === 0 ? { 'data-tour': 'reports-first-row' } : {})}
                >
                  <td className="px-4 py-4">
                    {r.ready ? (
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggle(r.uuid)}
                        disabled={!isChecked && atMax}
                        aria-label={`Select ${r.title || 'Untitled'}`}
                        className={CHECKBOX_CLASS}
                      />
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {r.releasedAt
                      ? new Date(r.releasedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    <div className="max-w-lg truncate">{r.title || 'Untitled'}</div>
                    {r.companyName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.companyName}</div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    {r.ready ? (
                      <div
                        className="flex items-center justify-end gap-2"
                        {...(index === 0 ? { 'data-tour': 'reports-actions' } : {})}
                      >
                        <Link href={`/pr/clips/${r.uuid}`}>
                          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Full Report
                          </Button>
                        </Link>
                        <Link href={`/pr/clipsreport/${r.uuid}`} target="_blank">
                          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Shareable
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Pending...</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {page > 1 && (
            <Link href={`/pr/reports?page=${page - 1}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Previous
              </Button>
            </Link>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={`/pr/reports?page=${page + 1}${brandFilter ? `&brand=${brandFilter}` : ''}`}>
              <Button variant="outline" size="sm" className="cursor-pointer">
                Next
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Sticky selection action bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
          <div className="mx-auto max-w-3xl m-4 flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-3 shadow-lg">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {selected.length} selected
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {selected.length >= MAX_SELECT
                  ? `Maximum of ${MAX_SELECT} reached`
                  : `Select up to ${MAX_SELECT}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                className="gap-1.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
              <Button
                size="sm"
                onClick={openConsolidated}
                disabled={selected.length < 2}
                className="gap-1.5 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer disabled:opacity-50"
              >
                <Layers className="h-4 w-4" />
                Consolidated Report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
