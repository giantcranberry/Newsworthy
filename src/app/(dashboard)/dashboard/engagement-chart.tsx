'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Chart } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  SelectRoot,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler)

interface EngagementStat {
  label: string
  views: number
  shares: number
  releases: number
}

interface BrandOption {
  id: number
  name: string
}

const SHARES_MULTIPLIER = 20

type ChartMode = 'cumulative' | 'monthly'

export function EngagementChart({ brands }: { brands: BrandOption[] }) {
  const [stats, setStats] = useState<EngagementStat[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<ChartMode>('cumulative')
  const [selectedBrand, setSelectedBrand] = useState<string>('all')

  const fetchStats = useCallback((companyId: string) => {
    setLoading(true)
    const params = companyId !== 'all' ? `?companyId=${companyId}` : ''
    fetch(`/api/dashboard/engagement-stats${params}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchStats(selectedBrand)
  }, [selectedBrand, fetchStats])

  const handleBrandChange = (value: string) => {
    setSelectedBrand(value)
  }

  if (loading && !stats.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Engagement Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading chart...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!stats.length && !loading) {
    return null
  }

  // Build cumulative data
  const cumulativeStats = stats.reduce<EngagementStat[]>((acc, stat) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : { views: 0, shares: 0, releases: 0 }
    acc.push({
      label: stat.label,
      views: prev.views + stat.views,
      shares: prev.shares + stat.shares,
      releases: stat.releases,
    })
    return acc
  }, [])

  const chartData = mode === 'cumulative' ? cumulativeStats : stats
  const labels = chartData.map((s) => s.label)

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base sm:text-lg">Engagement Over Time</CardTitle>
          <div className="flex items-center gap-2">
            {brands.length > 1 && (
              <SelectRoot value={selectedBrand} onValueChange={handleBrandChange}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            )}
            <div className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
              <button
                onClick={() => setMode('cumulative')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'cumulative'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Cumulative
              </button>
              <button
                onClick={() => setMode('monthly')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  mode === 'monthly'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        <div className={`h-[300px] ${loading ? 'opacity-50' : ''}`}>
          <Chart
            type="line"
            data={{
              labels,
              datasets: [
                {
                  type: 'line' as const,
                  label: 'Views',
                  data: chartData.map((s) => s.views),
                  borderColor: '#3b82f6',
                  backgroundColor: 'rgba(59,130,246,0.1)',
                  fill: true,
                  tension: 0.3,
                  yAxisID: 'y',
                  order: 1,
                },
                {
                  type: 'line' as const,
                  label: `Shares (Scaled x ${SHARES_MULTIPLIER})`,
                  data: chartData.map((s) => s.shares * SHARES_MULTIPLIER),
                  borderColor: '#22c55e',
                  backgroundColor: 'rgba(34,197,94,0.1)',
                  fill: true,
                  tension: 0.3,
                  yAxisID: 'y',
                  order: 2,
                },
                {
                  type: 'line' as const,
                  label: 'Releases',
                  data: chartData.map((s) => s.releases),
                  borderColor: '#a855f7',
                  backgroundColor: 'rgba(168,85,247,0.08)',
                  fill: true,
                  tension: 0.3,
                  borderDash: [4, 3],
                  pointStyle: 'circle',
                  pointRadius: 3,
                  yAxisID: 'y1',
                  order: 3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              scales: {
                x: {
                  ticks: { maxTicksLimit: 8, font: { size: 10 } },
                },
                y: {
                  type: 'linear',
                  position: 'left',
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Engagement',
                    font: { size: 11 },
                  },
                },
                y1: {
                  type: 'linear',
                  position: 'right',
                  beginAtZero: true,
                  grid: { drawOnChartArea: false },
                  title: {
                    display: true,
                    text: 'Releases',
                    font: { size: 11 },
                  },
                  ticks: {
                    stepSize: 1,
                  },
                },
              },
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: { boxWidth: 12 },
                  onHover: (event: any) => {
                    if (event.native?.target) event.native.target.style.cursor = 'pointer'
                  },
                  onLeave: (event: any) => {
                    if (event.native?.target) event.native.target.style.cursor = 'default'
                  },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      const label = ctx.dataset.label || ''
                      if (label.startsWith('Shares')) {
                        const actual = chartData[ctx.dataIndex].shares
                        return `Shares: ${actual.toLocaleString()} (scaled x${SHARES_MULTIPLIER})`
                      }
                      return `${label}: ${(ctx.parsed.y ?? 0).toLocaleString()}`
                    },
                  },
                },
              },
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
