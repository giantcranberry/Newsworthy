'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DollarSign, TrendingUp, Calendar, CalendarDays, FileText, ExternalLink, RefreshCw, ChevronRight } from 'lucide-react'

interface SalesPeriod {
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
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{formatCents(current.amount)}</p>
      <p className="text-xs text-gray-500 mt-1">
        {current.count} transaction{current.count !== 1 ? 's' : ''}
      </p>
      <div className="mt-2 pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400">{prevLabel}</p>
        <p className="text-sm font-medium text-gray-500">{formatCents(previous.amount)}</p>
        <p className="text-xs text-gray-400">
          {previous.count} transaction{previous.count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

export function SalesStats() {
  const [data, setData] = useState<SalesData | null>(null)
  const [loading, setLoading] = useState(true)
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
    fetchSales()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-400" />
            Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            Loading sales data from Stripe...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-400" />
            Sales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const totalOutstanding = data.invoices.reduce((sum, inv) => sum + inv.amountRemaining, 0)

  return (
    <div className="space-y-4">
      {/* Sales Totals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              Sales
            </CardTitle>
            <div className="flex items-center gap-2">
              {data.cachedAt && (
                <span className="text-xs text-gray-400">
                  Updated {new Date(data.cachedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={() => fetchSales(true)} className="gap-1.5 text-xs text-gray-500">
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PeriodCard
              icon={<Calendar className="h-4 w-4 text-green-600" />}
              label="Today"
              current={data.today}
              previous={data.prevToday}
              prevLabel="Yesterday"
            />
            <PeriodCard
              icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
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
        </CardContent>
      </Card>

      {/* Outstanding Invoices */}
      {data.invoices.length > 0 && (
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
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {data.invoices.length}
                      </span>
                    </CardTitle>
                  </CollapsibleTrigger>
                </div>
                <p className="text-sm font-medium text-amber-700">
                  {formatCents(totalOutstanding)}
                </p>
              </div>
              <p className="text-xs text-gray-500 ml-6 mt-1">Last 30 days</p>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Invoice</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Customer</th>
                        <th className="text-right py-2 pr-4 font-medium text-gray-500">Amount Due</th>
                        <th className="text-right py-2 pr-4 font-medium text-gray-500">Remaining</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Created</th>
                        <th className="text-left py-2 pr-4 font-medium text-gray-500">Due</th>
                        <th className="text-right py-2 font-medium text-gray-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.invoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-100 last:border-0">
                          <td className="py-2.5 pr-4">
                            <span className="font-mono text-xs text-gray-700">{inv.number || inv.id.slice(-8)}</span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div>
                              {inv.customerName && (
                                <p className="text-gray-900 text-xs font-medium">{inv.customerName}</p>
                              )}
                              {inv.customerEmail && (
                                <p className="text-gray-500 text-xs">{inv.customerEmail}</p>
                              )}
                              {!inv.customerName && !inv.customerEmail && (
                                <p className="text-gray-400 text-xs">Unknown</p>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-right font-medium text-gray-900 text-xs">
                            {formatCents(inv.amountDue)}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-xs">
                            <span className={inv.amountRemaining > 0 ? 'text-amber-700 font-medium' : 'text-gray-500'}>
                              {formatCents(inv.amountRemaining)}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-gray-500">
                            {formatDate(inv.created)}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-gray-500">
                            {inv.dueDate ? formatDate(inv.dueDate) : '—'}
                          </td>
                          <td className="py-2.5 text-right">
                            {inv.hostedInvoiceUrl && (
                              <a href={inv.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-gray-500 hover:text-gray-700">
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
  )
}
