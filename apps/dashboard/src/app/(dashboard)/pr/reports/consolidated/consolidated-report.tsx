'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ReportData } from '@/services/report'
import { MAX_SELECT } from '../reports-table'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

// Distinct colors for up to 12 overlaid releases
const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#a855f7', '#64748b',
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Parse a TimeBucket key_as_string into an epoch (ms). The report service emits
 * three formats depending on release age: 'March 2026' (monthly), 'MM/dd/yyyy'
 * (daily), and 'MM/dd h:00 a' (hourly, no year). Returns null if unparseable.
 */
function parseStatKey(key: string, fallbackYear: number): number | null {
  const monthMatch = key.match(/^([A-Za-z]+)\s+(\d{4})$/)
  if (monthMatch) {
    const mi = MONTH_NAMES.indexOf(monthMatch[1])
    if (mi >= 0) return new Date(parseInt(monthMatch[2], 10), mi, 1).getTime()
  }
  const dayMatch = key.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dayMatch) return new Date(+dayMatch[3], +dayMatch[1] - 1, +dayMatch[2]).getTime()
  const hourMatch = key.match(/^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (hourMatch) {
    let h = +hourMatch[3] % 12
    if (/PM/i.test(hourMatch[5])) h += 12
    return new Date(fallbackYear, +hourMatch[1] - 1, +hourMatch[2], h, +hourMatch[4]).getTime()
  }
  const t = Date.parse(key)
  return Number.isNaN(t) ? null : t
}

function formatReleaseDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function buildNewsUrl(release: ReportData['release']) {
  if (!release.releaseAt) return '#'
  const d = new Date(release.releaseAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.newsworthy.ai/news/${y}${m}${day}${release.id}/${release.slug}`
}

interface Loaded {
  uuid: string
  data: ReportData
  color: string
}

export function ConsolidatedReport({
  isPublic = false,
  releaseUuids,
  title,
}: {
  isPublic?: boolean
  /** When provided (public/shared view), use these instead of the URL `ids`. */
  releaseUuids?: string[]
  title?: string | null
} = {}) {
  // useSearchParams must be called unconditionally (rules of hooks); the explicit
  // prop wins when present (shared link rendered server-side from a saved record).
  const searchParams = useSearchParams()
  const idsParam = searchParams.get('ids') || ''

  // Parse, dedupe, and cap the requested release uuids.
  const uuids = useMemo(
    () => {
      const source = releaseUuids ?? idsParam.split(',')
      return Array.from(new Set(source.map((s) => s.trim()).filter(Boolean))).slice(0, MAX_SELECT)
    },
    [idsParam, releaseUuids],
  )

  const [reports, setReports] = useState<Loaded[]>([])
  const [loading, setLoading] = useState(true)
  const [failedCount, setFailedCount] = useState(0)

  useEffect(() => {
    if (uuids.length < 2) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const reportQs = isPublic ? '?public=true' : ''
    Promise.all(
      uuids.map((uuid) =>
        fetch(`/api/pr/${uuid}/report${reportQs}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data: ReportData | null) => (data && data.release ? data : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return
      const loaded: Loaded[] = []
      let colorIdx = 0
      results.forEach((data) => {
        if (data) {
          loaded.push({ uuid: data.release.uuid, data, color: PALETTE[colorIdx % PALETTE.length] })
          colorIdx++
        }
      })
      setReports(loaded)
      setFailedCount(results.filter((r) => !r).length)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [uuids, isPublic])

  // --- Aggregate metrics ---
  const agg = useMemo(() => {
    const totalPv = reports.reduce((s, r) => s + r.data.totalPv, 0)
    const totalSh = reports.reduce((s, r) => s + r.data.totalSh, 0)
    const totalPdf = reports.reduce((s, r) => s + (r.data.pdfDownloadCount || 0), 0)
    const totalEng = totalPv + totalSh
    // Each release carries a standard $129 distribution cost; consolidated eCPC
    // spreads the combined cost over combined engagement.
    const ecpc = totalEng > 0 ? (Math.floor((129 * reports.length) / totalEng * 100) / 100).toFixed(2) : '0.00'
    return { totalPv, totalSh, totalPdf, totalEng, ecpc, count: reports.length }
  }, [reports])

  // Freshest data timestamp across all loaded reports (data is fetched live on
  // every visit, so this reflects how current the numbers are).
  const generatedAt = useMemo(() => {
    const latest = reports.reduce((max, r) => {
      const t = Date.parse(r.data.fetchedAt)
      return Number.isNaN(t) ? max : Math.max(max, t)
    }, 0)
    if (!latest) return ''
    return new Date(latest).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'America/New_York',
    }) + ' ET'
  }, [reports])

  // --- Per-release overlay + aggregate total, on SEPARATE charts ---
  // (Mixing them on one chart with two y-axes makes a single release appear to
  // sit "above" the total because each axis has a different scale.)
  const ONE_DAY = 86_400_000
  const { releaseData, totalData, noLineTitles, legendItems } = useMemo(() => {
    const now = Date.now()
    const perRelease = reports.map((r) => {
      const releaseStart = r.data.release.releasedAt ? new Date(r.data.release.releasedAt).getTime() : NaN
      const year = Number.isNaN(releaseStart) ? new Date().getFullYear() : new Date(releaseStart).getFullYear()
      const stats = r.data.constGrowthStats

      const raw = stats
        .map((s) => {
          const x = parseStatKey(s.key_as_string, year)
          return x === null ? null : { x, y: s.views }
        })
        .filter((p): p is { x: number; y: number } => p !== null)

      let points: { x: number; y: number }[] = []
      if (raw.length > 0) {
        // Accurate dates: anchor the line at 0 on (or just before) its first
        // point so it rises from zero instead of starting mid-air.
        const anchorX = !Number.isNaN(releaseStart) && releaseStart < raw[0].x ? releaseStart : raw[0].x - ONE_DAY
        points = [{ x: anchorX, y: 0 }, ...raw]
      } else if (stats.length > 0) {
        // Fallback: keys didn't parse, but the release has a cumulative series —
        // spread its points evenly across releaseStart→now so it still draws a line.
        const start = Number.isNaN(releaseStart) ? now - stats.length * ONE_DAY : releaseStart
        const span = Math.max(now - start, ONE_DAY)
        const n = stats.length
        const seq = stats.map((s, i) => ({ x: start + (span * i) / Math.max(1, n - 1), y: s.views }))
        points = [{ x: start, y: 0 }, ...seq]
      }
      return { color: r.color, title: r.data.release.title || 'Untitled', points }
    })

    // Only chart releases that actually have a line; flag the rest explicitly.
    const plottable = perRelease.filter((p) => p.points.length > 0)
    const noLineTitles = perRelease.filter((p) => p.points.length === 0).map((p) => p.title)

    const releaseDatasets = plottable.map((p) => ({
      label: p.title,
      data: p.points,
      borderColor: p.color,
      backgroundColor: p.color,
      fill: false,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
      pointStyle: 'rectRounded' as const,
    }))

    // Aggregate total views over time: at each timestamp, sum every release's
    // most recent cumulative value (carry-forward, 0 before its start).
    const allX = Array.from(new Set(perRelease.flatMap((p) => p.points.map((pt) => pt.x)))).sort((a, b) => a - b)
    const totalPoints = allX.map((x) => {
      let total = 0
      for (const p of perRelease) {
        let val = 0
        for (const pt of p.points) {
          if (pt.x <= x) val = pt.y
          else break
        }
        total += val
      }
      return { x, y: total }
    })

    return {
      noLineTitles,
      legendItems: plottable.map((p) => ({ color: p.color, title: p.title })),
      releaseData: { datasets: releaseDatasets },
      totalData: {
        datasets: [
          {
            label: 'Total Views (all releases)',
            data: totalPoints,
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124,58,237,0.10)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2.5,
            pointStyle: 'rectRounded' as const,
          },
        ],
      },
    }
  }, [reports])

  // Shared x-axis (linear time) + tooltip date formatting for both charts.
  const timeAxisOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        x: {
          type: 'linear',
          ticks: {
            maxTicksLimit: 10,
            font: { size: 10 },
            callback: (value) =>
              new Date(value as number).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          },
        },
        y: { beginAtZero: true },
      },
      plugins: {
        // Built-in legend is disabled; we render a custom one-per-line HTML
        // legend below the per-release chart for readability with long titles.
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const x = items[0]?.parsed?.x
              return typeof x === 'number'
                ? new Date(x).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : ''
            },
          },
        },
      },
    }),
    [],
  )

  const hasGrowth = reports.some((r) => r.data.constGrowthStats.length > 0)

  if (uuids.length < 2) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-gray-600 dark:text-gray-400">
          Select at least two published releases to build a consolidated report.
        </p>
        <Link href="/pr/reports" className="text-blue-600 dark:text-blue-400 hover:underline">
          ‹ Back to Reports
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <i className="fa-solid fa-spinner fa-spin text-gray-400 text-3xl" aria-hidden="true" />
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-red-600 dark:text-red-400">None of the selected reports could be loaded.</p>
        <Link href="/pr/reports" className="text-blue-600 dark:text-blue-400 hover:underline">
          ‹ Back to Reports
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      {!isPublic && (
        <div className="print:hidden flex items-center justify-between gap-4">
          <Link href="/pr/reports" className="text-blue-600 dark:text-blue-400 hover:underline">
            <strong>&lsaquo;</strong> return to reports
          </Link>
          <ShareBar uuids={uuids} />
        </div>
      )}

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-[2rem] font-bold text-gray-900 dark:text-gray-100 mb-0">
            {title || 'Consolidated Clipping Report'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-[0.95rem] mb-0">
            <i className="fa-solid fa-layer-group mr-2" aria-hidden="true" />
            {agg.count} press release{agg.count === 1 ? '' : 's'} combined
            {failedCount > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400">
                ({failedCount} could not be loaded)
              </span>
            )}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-[0.95rem]">
            <i className="fa-solid fa-calendar-days mr-2" aria-hidden="true" />
            Report generated {generatedAt}
          </p>
        </div>
      </div>

      {/* Hero: consolidated eCPC + summary */}
      <div className="rounded-2xl bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row items-center">
          <div className="w-full sm:w-1/4 text-center sm:border-r border-white/20 py-3 shrink-0">
            <i className="fa-solid fa-trophy text-4xl mb-3 opacity-90 block" aria-hidden="true" />
            <h1 className="text-5xl sm:text-6xl font-bold mb-2 text-white break-words" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
              ${agg.ecpc}
            </h1>
            <h5 className="text-white opacity-95 font-medium mb-2">Effective CPC</h5>
            <small className="block opacity-85">Across {agg.count} releases</small>
          </div>
          <div className="w-full sm:w-3/4 mt-4 sm:mt-0 sm:pl-6">
            <h3 className="text-xl font-semibold text-white mb-3">Combined Campaign Performance</h3>
            <p className="mb-0 opacity-90 text-[1.05rem] leading-relaxed">
              These {agg.count} press releases generated a combined{' '}
              <strong>{agg.totalEng.toLocaleString()}</strong> engagements across our distribution network,
              reaching an audience of more than 1.182 billion in their native language.
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
        <MetricCard icon="fa-eye" iconColor="text-blue-600 dark:text-blue-400" value={agg.totalPv.toLocaleString()} label="Total Views" />
        <MetricCard icon="fa-share-nodes" iconColor="text-green-500" value={agg.totalSh.toLocaleString()} label="Total Shares" />
        <MetricCard icon="fa-file-pdf" iconColor="text-red-500" value={agg.totalPdf.toLocaleString()} label="PDF Downloads" />
        <MetricCard icon="fa-layer-group" iconColor="text-[#764ba2]" value={agg.count.toLocaleString()} label="Releases" />
      </div>

      {/* Total cumulative views over time (aggregate of all releases) */}
      {hasGrowth && (
        <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900">
          <div className="p-5">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h6 className="font-semibold text-gray-800 dark:text-gray-200">Total Views Over Time</h6>
                <p className="text-xs text-gray-500 dark:text-gray-400">Combined cumulative views across all {agg.count} releases</p>
              </div>
              <span className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-gray-400">UTC</span>
            </div>
            <div className="h-[300px]">
              <Line data={totalData} options={timeAxisOptions} />
            </div>
          </div>
        </div>
      )}

      {/* Per-release cumulative growth overlay (single axis: each line rises from 0) */}
      {hasGrowth && (
        <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900">
          <div className="p-5">
            <div className="flex justify-between items-start mb-1">
              <div>
                <h6 className="font-semibold text-gray-800 dark:text-gray-200">Cumulative Growth by Release</h6>
                <p className="text-xs text-gray-500 dark:text-gray-400">Compare each release&apos;s view momentum over time</p>
              </div>
              <span className="text-xs bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5 text-gray-500 dark:text-gray-400">UTC</span>
            </div>
            <div className="h-[420px]">
              <Line data={releaseData} options={timeAxisOptions} />
            </div>
            {/* Custom legend: one release per line, left-justified */}
            <ul className="mt-4 space-y-1.5" style={{ paddingLeft: 75 }}>
              {legendItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span
                    className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-[3px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.title}</span>
                </li>
              ))}
            </ul>
            {noLineTitles.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                No time-series data yet for: {noLineTitles.join('; ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Per-release side-by-side cards */}
      <div>
        <div className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-3">
          <i className="fa-solid fa-rectangle-list text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span>Side-by-Side Performance</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map((r) => (
            <ReleaseCard key={r.uuid} loaded={r} isPublic={isPublic} />
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Share bar: create a public short-link for the current selection ---
function ShareBar({ uuids }: { uuids: string[] }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/pr/reports/consolidated/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: uuids, title: title.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Could not create link')
      setShareUrl(`${window.location.origin}/pr/clipsreport/consolidated/${data.uuid}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create link')
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
      >
        <i className="fa-solid fa-share-nodes text-cyan-700 dark:text-cyan-500" aria-hidden="true" />
        Create shareable link
      </button>
    )
  }

  return (
    <div className="w-full max-w-md rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 shadow-sm">
      {shareUrl ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Public link (always shows current numbers)
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-700 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
            >
              <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Open ↗
            </a>
            <Link href="/pr/reports/shared" className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
              Manage shared reports
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional title (e.g. Q2 Campaign)"
            maxLength={200}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1.5 text-sm text-gray-800 dark:text-gray-200"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={create}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-md bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600 dark:hover:bg-cyan-700 px-3 py-1.5 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
            >
              {creating ? (
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
              ) : (
                <i className="fa-solid fa-link" aria-hidden="true" />
              )}
              {creating ? 'Creating…' : 'Generate link'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-sm text-gray-500 dark:text-gray-400 hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon, iconColor, value, label }: { icon: string; iconColor: string; value: string; label: string }) {
  return (
    <div className="rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.08)] bg-white dark:bg-gray-900">
      <div className="text-center py-6 flex flex-col justify-center items-center">
        <i className={`fa-solid ${icon} ${iconColor} mb-3 text-[2rem]`} aria-hidden="true" />
        <div className="text-[2.5rem] font-bold text-gray-900 dark:text-gray-100 leading-none">{value}</div>
        <div className="text-sm uppercase tracking-wider text-gray-500 dark:text-gray-400 opacity-80 mt-2">{label}</div>
      </div>
    </div>
  )
}

function ReleaseCard({ loaded, isPublic }: { loaded: Loaded; isPublic: boolean }) {
  const { data, color } = loaded
  const { release, company, totalPv, totalSh, ecpc, constGrowthStats } = data
  const year = release.releasedAt ? new Date(release.releasedAt).getFullYear() : new Date().getFullYear()

  const sparkData = useMemo(() => {
    const points = constGrowthStats
      .map((s) => {
        const x = parseStatKey(s.key_as_string, year)
        return x === null ? null : { x, y: s.views }
      })
      .filter((p): p is { x: number; y: number } => p !== null)
    return {
      datasets: [
        {
          data: points,
          borderColor: color,
          backgroundColor: `${color}1a`,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    }
  }, [constGrowthStats, color, year])

  return (
    <div className="rounded-xl border-t-4 bg-white dark:bg-gray-900 shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col" style={{ borderTopColor: color }}>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          {company.logoUrl && (
            <img src={company.logoUrl} alt={company.companyName} className="h-5 max-w-[80px] object-contain" />
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">{formatReleaseDate(release.releasedAt)}</span>
        </div>
        <a
          href={buildNewsUrl(release)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gray-900 dark:text-gray-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2 min-h-[2.6em]"
        >
          {release.title || 'Untitled'}
        </a>

        {/* Sparkline */}
        <div className="h-[90px] my-3">
          {constGrowthStats.length > 0 ? (
            <Line
              data={sparkData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  x: { type: 'linear', display: false },
                  y: { display: false, beginAtZero: true },
                },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">No activity data</div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 dark:border-gray-800 pt-3">
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{totalPv.toLocaleString()}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-gray-400 mt-1">Views</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{totalSh.toLocaleString()}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-gray-400 mt-1">Shares</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">${ecpc}</div>
            <div className="text-[0.65rem] uppercase tracking-wider text-gray-400 mt-1">eCPC</div>
          </div>
        </div>
      </div>

      {/* Public viewers go to the public single-report route; authenticated
          dashboard viewers go to the in-app report. */}
      {isPublic ? (
        <a
          href={`/pr/clipsreport/${release.uuid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 py-2.5 border-t border-gray-100 dark:border-gray-800"
        >
          View full report ↗
        </a>
      ) : (
        <Link
          href={`/pr/clips/${release.uuid}`}
          className="block text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 py-2.5 border-t border-gray-100 dark:border-gray-800"
        >
          View full report →
        </Link>
      )}
    </div>
  )
}
