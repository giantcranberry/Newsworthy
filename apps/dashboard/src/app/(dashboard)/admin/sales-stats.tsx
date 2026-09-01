'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DollarSign, TrendingUp, Calendar, CalendarDays, FileText, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
)

interface SalesPeriod {
  amount: number
  count: number
}

interface DailySalesPoint {
  date: string
  label: string
  amount: number
  count: number
}

interface Invoice {
  id: string
  number: string | null
  customerEmail: string | null
  customerName: string | null
  amountDue: number
  amountPaid: number
  amountRemaining: number
  status: string | null
  dueDate: number | null
  created: number
  hostedInvoiceUrl: string | null
}

interface SalesData {
  today: SalesPeriod
  wtd: SalesPeriod
  mtd: SalesPeriod
  ytd: SalesPeriod
  prevToday: SalesPeriod
  prevWtd: SalesPeriod
  prevMtd: SalesPeriod
  prevYtd: SalesPeriod
  series: DailySalesPoint[]
  invoices: Invoice[]
  cachedAt: number
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function PeriodCard({
  icon,
  label,
  current,
  previous,
  prevLabel,
}: {
  icon: React.ReactNode
  label: string
  current: SalesPeriod
  previous: SalesPeriod
  prevLabel: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCents(current.amount)}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {current.count} transaction{current.count !== 1 ? 's' : ''}
      </p>
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <p className="text-xs text-gray-400">{prevLabel}</p>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{formatCents(previous.amount)}</p>
        <p className="text-xs text-gray-400">
          {previous.count} transaction{previous.count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

type SeriesRange = 30 | 90

function SalesActivityChart({ series }: { series: DailySalesPoint[] }) {
  const [range, setRange] = useState<SeriesRange>(30)

  const points = useMemo(
    () => (series.length <= range ? series : series.slice(-range)),
    [series, range],
  )

  const totalAmount = points.reduce((sum, p) => sum + p.amount, 0)
  const totalCount = points.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Activity over time
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {formatCents(totalAmount)} · {totalCount} transaction
            {totalCount !== 1 ? 's' : ''} in this range
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
          {([30, 90] as const).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setRange(days)}
              className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                range === days
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>
      <div className="h-[260px]">
        <Chart
          type="bar"
          data={{
            labels: points.map((p) => p.label),
            datasets: [
              {
                type: 'bar' as const,
                label: 'Revenue',
                data: points.map((p) => p.amount / 100),
                backgroundColor: 'rgba(37, 99, 235, 0.55)',
                borderColor: 'rgb(37, 99, 235)',
                borderWidth: 1,
                borderRadius: 3,
                yAxisID: 'y',
                order: 2,
              },
              {
                type: 'line' as const,
                label: 'Transactions',
                data: points.map((p) => p.count),
                borderColor: 'rgb(217, 119, 6)',
                backgroundColor: 'rgba(217, 119, 6, 0.1)',
                tension: 0.3,
                pointRadius: 2,
                pointHoverRadius: 4,
                yAxisID: 'y1',
                order: 1,
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
              x: {
                ticks: {
                  maxTicksLimit: range === 30 ? 10 : 12,
                  font: { size: 10 },
                  maxRotation: 0,
                },
                grid: { display: false },
              },
              y: {
                type: 'linear',
                position: 'left',
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Revenue ($)',
                  font: { size: 11 },
                },
                ticks: {
                  callback: (value) =>
                    typeof value === 'number'
                      ? `$${value.toLocaleString()}`
                      : value,
                },
              },
              y1: {
                type: 'linear',
                position: 'right',
                beginAtZero: true,
                grid: { drawOnChartArea: false },
                title: {
                  display: true,
                  text: 'Transactions',
                  font: { size: 11 },
                },
                ticks: { stepSize: 1 },
              },
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: { boxWidth: 12 },
              },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    if (ctx.dataset.label === 'Revenue') {
                      return `Revenue: ${formatCents(Math.round((ctx.parsed.y ?? 0) * 100))}`
                    }
                    return `Transactions: ${ctx.parsed.y ?? 0}`
                  },
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}

export function SalesStats() {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSales = async (refresh: boolean = false) => {
    setLoading(true)
    setError('')
    try {
      const url = refresh ? '/api/admin/sales?refresh=true' : '/api/admin/sales'
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch sales data')
      }
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && !data && !loading) {
      fetchSales()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when first expanded
  }, [open])

  const totalOutstanding = data?.invoices.reduce((sum, inv) => sum + inv.amountRemaining, 0) ?? 0

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="space-y-4">
        <Card>
          <CardHeader className={open ? undefined : 'pb-6'}>
            <div className="flex items-center justify-between gap-3">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex items-center gap-2 text-left cursor-pointer"
                  data-tour="admin-sales-toggle"
                >
                  <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-gray-400" />
                    Sales
                  </CardTitle>
                  {!open && (
                    <span className="text-xs text-gray-400 font-normal">Click to reveal</span>
                  )}
                </button>
              </CollapsibleTrigger>
              {open && (
                <div className="flex items-center gap-2">
                  {data?.cachedAt && (
                    <span className="text-xs text-gray-400">
                      Updated {new Date(data.cachedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchSales(true)}
                    disabled={loading}
                    className="gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {loading && (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                  Loading sales data from Stripe...
                </div>
              )}
              {error && !loading && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              {data && !loading && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PeriodCard
                      icon={<Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />}
                      label="Today"
                      current={data.today}
                      previous={data.prevToday}
                      prevLabel="Yesterday"
                    />
                    <PeriodCard
                      icon={<CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      label="Week to Date"
                      current={data.wtd}
                      previous={data.prevWtd}
                      prevLabel="Last Week"
                    />
                    <PeriodCard
                      icon={<TrendingUp className="h-4 w-4 text-purple-600" />}
                      label="Month to Date"
                      current={data.mtd}
                      previous={data.prevMtd}
                      prevLabel="Last Month"
                    />
                    <PeriodCard
                      icon={<DollarSign className="h-4 w-4 text-amber-600" />}
                      label="Year to Date"
                      current={data.ytd}
                      previous={data.prevYtd}
                      prevLabel="Last Year"
                    />
                  </div>
                  {data.series?.length > 0 && (
                    <SalesActivityChart series={data.series} />
                  )}
                </>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>

        {open && data && data.invoices.length > 0 && (
          <Collapsible>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CollapsibleTrigger className="flex items-center gap-2 cursor-pointer group">
                      <ChevronRight className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-gray-400" />
                        Outstanding Invoices
                        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                          {data.invoices.length}
                        </span>
                      </CardTitle>
                    </CollapsibleTrigger>
                  </div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    {formatCents(totalOutstanding)}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">Last 30 days</p>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800">
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Customer</th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Amount Due</th>
                          <th className="text-right py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Remaining</th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Created</th>
                          <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Due</th>
                          <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.invoices.map((inv) => (
                          <tr key={inv.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <td className="py-2.5 pr-4">
                              <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{inv.number || inv.id.slice(-8)}</span>
                            </td>
                            <td className="py-2.5 pr-4">
                              <div>
                                {inv.customerName && (
                                  <p className="text-gray-900 dark:text-gray-100 text-xs font-medium">{inv.customerName}</p>
                                )}
                                {inv.customerEmail && (
                                  <p className="text-gray-500 dark:text-gray-400 text-xs">{inv.customerEmail}</p>
                                )}
                                {!inv.customerName && !inv.customerEmail && (
                                  <p className="text-gray-400 text-xs">Unknown</p>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 pr-4 text-right font-medium text-gray-900 dark:text-gray-100 text-xs">
                              {formatCents(inv.amountDue)}
                            </td>
                            <td className="py-2.5 pr-4 text-right text-xs">
                              <span className={inv.amountRemaining > 0 ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
                                {formatCents(inv.amountRemaining)}
                              </span>
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(inv.created)}
                            </td>
                            <td className="py-2.5 pr-4 text-xs text-gray-500 dark:text-gray-400">
                              {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              {inv.hostedInvoiceUrl && (
                                <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 dark:text-gray-300">
                                    <ExternalLink className="h-3 w-3" />
                                    View
                                  </Button>
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>
    </Collapsible>
  )
}
