'use client'

import { useCallback, useEffect, useState } from 'react'
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
  ArcElement,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Users,
  Eye,
  MousePointerClick,
  Timer,
  RefreshCw,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  ArrowLeft,
  AlertTriangle,
} from 'lucide-react'
import type {
  GaDateRange,
  GaPropertyReport,
  GaPropertySummary,
} from '@/lib/google-analytics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement
)

interface PropertyOption {
  label: string
  propertyId: string
  accountName?: string
}

interface AnalyticsResponse {
  configured: boolean
  properties: PropertyOption[]
  overview?: GaPropertySummary[]
  report?: GaPropertyReport
  source?: 'env' | 'discovery' | 'none'
  fetchedAt?: number
  error?: string
  discoveryError?: string
  serviceAccountEmail?: string | null
  setup?: {
    missing: string[]
    serviceAccountEmail: string | null
    hint?: string
  }
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m <= 0) return `${s}s`
  return `${m}m ${s}s`
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}

function ChangeBadge({ current, previous }: { current: number; previous: number }) {
  const change = pctChange(current, previous)
  if (change === null) {
    return <span className="text-xs text-gray-400">vs prior period</span>
  }
  if (Math.abs(change) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-gray-500 dark:text-gray-400">
        <Minus className="h-3 w-3" />
        0% vs prior
      </span>
    )
  }
  const up = change > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? '+' : ''}
      {change.toFixed(1)}% vs prior
    </span>
  )
}

function SetupCard({ data }: { data: AnalyticsResponse }) {
  const email = data.setup?.serviceAccountEmail || data.serviceAccountEmail
  const needsCredentials = (data.setup?.missing?.length || 0) > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {needsCredentials ? 'Google Analytics setup required' : 'Almost ready'}
        </CardTitle>
        <CardDescription>
          {needsCredentials
            ? 'Add a service account with Analytics Data API access, then set env vars.'
            : 'Credentials are set, but no GA4 properties are available yet.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
        {needsCredentials ? (
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Enable the{' '}
              <a
                className="text-cyan-700 dark:text-cyan-400 underline"
                href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Data API
              </a>{' '}
              and{' '}
              <a
                className="text-cyan-700 dark:text-cyan-400 underline"
                href="https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Admin API
              </a>
              .
            </li>
            <li>Create a service account JSON key and set GA_CLIENT_EMAIL / GA_PRIVATE_KEY.</li>
            <li>
              In each GA4 property → Admin → Property access management, add the service account as
              Viewer.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Enable the{' '}
              <a
                className="text-cyan-700 dark:text-cyan-400 underline"
                href="https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=newsworthytts"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Analytics Admin API
              </a>{' '}
              and{' '}
              <a
                className="text-cyan-700 dark:text-cyan-400 underline"
                href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=newsworthytts"
                target="_blank"
                rel="noopener noreferrer"
              >
                Analytics Data API
              </a>{' '}
              on GCP project <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">newsworthytts</code>.
            </li>
            <li>
              In each GA4 property → Admin → Property access management, add{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                {email || 'the service account email'}
              </code>{' '}
              as <strong>Viewer</strong>.
            </li>
            <li>
              Or set properties manually:{' '}
              <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">
                GA_PROPERTIES=newsworthy.ai:123456789,newsramp.com:987654321
              </code>
            </li>
          </ol>
        )}

        {data.setup?.missing?.length ? (
          <p>
            Missing:{' '}
            <span className="font-mono text-xs text-amber-700 dark:text-amber-400">
              {data.setup.missing.join(', ')}
            </span>
          </p>
        ) : null}

        {(data.discoveryError || data.setup?.hint) && (
          <p className="rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            {data.discoveryError || data.setup?.hint}
          </p>
        )}

        {email ? (
          <p>
            Service account:{' '}
            <span className="font-mono text-xs text-gray-800 dark:text-gray-200">{email}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function RangeControls({
  range,
  loading,
  onChange,
}: {
  range: GaDateRange
  loading: boolean
  onChange: (r: GaDateRange) => void
}) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-800 p-0.5">
      {(['7d', '28d', '90d'] as GaDateRange[]).map((r) => (
        <Button
          key={r}
          type="button"
          size="sm"
          variant={range === r ? 'default' : 'ghost'}
          className="h-8 px-3 text-xs"
          onClick={() => onChange(r)}
          disabled={loading}
        >
          {r === '7d' ? '7 days' : r === '28d' ? '28 days' : '90 days'}
        </Button>
      ))}
    </div>
  )
}

export function AnalyticsDashboard() {
  const [range, setRange] = useState<GaDateRange>('28d')
  const [propertyId, setPropertyId] = useState<string | null>(null)
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [overview, setOverview] = useState<GaPropertySummary[]>([])
  const [report, setReport] = useState<GaPropertyReport | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupPayload, setSetupPayload] = useState<AnalyticsResponse | null>(null)
  const [source, setSource] = useState<string>('')

  const fetchAnalytics = useCallback(
    async (opts?: { propertyId?: string | null; range?: GaDateRange }) => {
      setLoading(true)
      setError('')
      try {
        const pid = opts?.propertyId !== undefined ? opts.propertyId : propertyId
        const r = opts?.range ?? range
        const params = new URLSearchParams({ range: r })
        if (pid) params.set('propertyId', pid)

        const res = await fetch(`/api/admin/analytics?${params}`)
        const data: AnalyticsResponse = await res.json()

        if (!data.configured || (data.configured && data.properties.length === 0 && !data.report && !data.overview)) {
          setSetupPayload(data)
          setOverview([])
          setReport(null)
          setProperties(data.properties || [])
          return
        }

        setSetupPayload(null)
        setProperties(data.properties || [])
        setSource(data.source || '')

        if (!res.ok || data.error) {
          setError(data.error || 'Failed to load analytics')
          setOverview([])
          setReport(null)
          return
        }

        if (data.report) {
          setReport(data.report)
          setOverview([])
        } else if (data.overview) {
          setOverview(data.overview)
          setReport(null)
        }

        setFetchedAt(data.fetchedAt || Date.now())
      } catch (e: any) {
        setError(e.message || 'Failed to load analytics')
        setOverview([])
        setReport(null)
      } finally {
        setLoading(false)
      }
    },
    [propertyId, range]
  )

  useEffect(() => {
    fetchAnalytics({ propertyId: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openProperty = (id: string) => {
    setPropertyId(id)
    fetchAnalytics({ propertyId: id })
  }

  const backToOverview = () => {
    setPropertyId(null)
    setReport(null)
    fetchAnalytics({ propertyId: null })
  }

  if (setupPayload) {
    return <SetupCard data={setupPayload} />
  }

  const chartLabels =
    report?.timeseries.map((p) => {
      const d = new Date(p.date + 'T00:00:00')
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }) || []

  const lineData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Active users',
        data: report?.timeseries.map((p) => p.activeUsers) || [],
        borderColor: 'rgb(8, 145, 178)',
        backgroundColor: 'rgba(8, 145, 178, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
      {
        label: 'Page views',
        data: report?.timeseries.map((p) => p.pageViews) || [],
        borderColor: 'rgb(217, 119, 6)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      },
    ],
  }

  const channelData = {
    labels: report?.channels.map((c) => c.channel) || [],
    datasets: [
      {
        label: 'Sessions',
        data: report?.channels.map((c) => c.sessions) || [],
        backgroundColor: 'rgba(8, 145, 178, 0.75)',
        borderRadius: 4,
      },
    ],
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { boxWidth: 12, font: { size: 11 } },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
      },
      y: {
        beginAtZero: true,
        ticks: { font: { size: 10 } },
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
      },
    },
  }

  const overviewTotals = overview.reduce(
    (acc, row) => {
      acc.users += row.totals.activeUsers
      acc.sessions += row.totals.sessions
      acc.views += row.totals.pageViews
      acc.live += row.realtimeUsers || 0
      return acc
    },
    { users: 0, sessions: 0, views: 0, live: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {propertyId ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-gray-500 dark:text-gray-400"
              onClick={backToOverview}
              disabled={loading}
            >
              <ArrowLeft className="h-3 w-3" />
              All properties
            </Button>
          ) : null}

          {propertyId ? (
            <select
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900"
              value={propertyId}
              onChange={(e) => openProperty(e.target.value)}
              disabled={loading || properties.length === 0}
            >
              {properties.map((p) => (
                <option key={p.propertyId} value={p.propertyId}>
                  {p.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
              {source === 'discovery' ? ' · auto-discovered' : source === 'env' ? ' · from env' : ''}
            </p>
          )}

          <RangeControls
            range={range}
            loading={loading}
            onChange={(r) => {
              setRange(r)
              fetchAnalytics({ range: r })
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {fetchedAt && (
            <span className="text-xs text-gray-400">
              Updated{' '}
              {new Date(fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-gray-500 dark:text-gray-400"
            onClick={() => fetchAnalytics()}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {report && (
            <a
              href={`https://analytics.google.com/analytics/web/#/p${report.propertyId}/`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-3 w-3" />
                Open in GA
              </Button>
            </a>
          )}
        </div>
      </div>

      {error && (
        <Card className="border-red-200 dark:border-red-900/40">
          <CardContent className="p-4 text-sm text-red-600 dark:text-red-400 space-y-1">
            <p>{error}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Confirm the service account is Viewer on this GA4 property and that the Property ID is
              correct.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && !report && overview.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading Google Analytics…
          </CardContent>
        </Card>
      ) : null}

      {/* Overview */}
      {!propertyId && overview.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Activity className="h-3.5 w-3.5" />
                  Live now
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(overviewTotals.live)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Users className="h-3.5 w-3.5" />
                  Users
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(overviewTotals.users)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Sessions
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(overviewTotals.sessions)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Eye className="h-3.5 w-3.5" />
                  Page views
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(overviewTotals.views)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {overview.map((row) => (
              <button
                key={row.propertyId}
                type="button"
                onClick={() => openProperty(row.propertyId)}
                className="text-left"
              >
                <Card className="h-full transition-colors hover:border-cyan-600/40 dark:hover:border-cyan-500/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{row.label}</CardTitle>
                    <CardDescription>
                      {row.accountName ? `${row.accountName} · ` : ''}
                      ID {row.propertyId}
                      {row.realtimeUsers != null ? ` · ${row.realtimeUsers} live` : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {row.error ? (
                      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>{row.error}</span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Users</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatNumber(row.totals.activeUsers)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Sessions</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatNumber(row.totals.sessions)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Views</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {formatNumber(row.totals.pageViews)}
                            </p>
                          </div>
                        </div>
                        <ChangeBadge
                          current={row.totals.activeUsers}
                          previous={row.previousTotals.activeUsers}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Property detail */}
      {report ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Activity className="h-3.5 w-3.5" />
                  Live now
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {report.realtimeUsers == null ? '—' : formatNumber(report.realtimeUsers)}
                </p>
                <p className="text-xs text-gray-400">Active users (realtime)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Users className="h-3.5 w-3.5" />
                  Users
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(report.totals.activeUsers)}
                </p>
                <ChangeBadge
                  current={report.totals.activeUsers}
                  previous={report.previousTotals.activeUsers}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  Sessions
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(report.totals.sessions)}
                </p>
                <ChangeBadge
                  current={report.totals.sessions}
                  previous={report.previousTotals.sessions}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Eye className="h-3.5 w-3.5" />
                  Page views
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatNumber(report.totals.pageViews)}
                </p>
                <ChangeBadge
                  current={report.totals.pageViews}
                  previous={report.previousTotals.pageViews}
                />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-1">
                <div className="flex items-center gap-2 text-xs uppercase text-gray-500 dark:text-gray-400">
                  <Timer className="h-3.5 w-3.5" />
                  Avg session
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {formatDuration(report.totals.averageSessionDuration)}
                </p>
                <p className="text-xs text-gray-400">
                  Bounce {formatPercent(report.totals.bounceRate)}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Traffic over time</CardTitle>
                <CardDescription>
                  {report.startDate} → {report.endDate}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <Line data={lineData} options={chartOptions} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Channels</CardTitle>
                <CardDescription>Sessions by default channel group</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {report.channels.length > 0 ? (
                    <Bar
                      data={channelData}
                      options={{
                        ...chartOptions,
                        indexAxis: 'y' as const,
                        plugins: { ...chartOptions.plugins, legend: { display: false } },
                      }}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400">
                      No channel data
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top pages</CardTitle>
              <CardDescription>Highest page views in this range</CardDescription>
            </CardHeader>
            <CardContent>
              {report.topPages.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No page data</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                          Path
                        </th>
                        <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                          Views
                        </th>
                        <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">
                          Users
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.topPages.map((page) => (
                        <tr
                          key={page.path}
                          className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                        >
                          <td className="py-2.5 pr-4 font-mono text-xs text-gray-800 dark:text-gray-200 max-w-[28rem] truncate">
                            {page.path}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-gray-900 dark:text-gray-100">
                            {formatNumber(page.pageViews)}
                          </td>
                          <td className="py-2.5 text-right text-gray-500 dark:text-gray-400">
                            {formatNumber(page.activeUsers)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
