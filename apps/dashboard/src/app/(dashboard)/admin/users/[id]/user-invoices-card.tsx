'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InvoiceUserDialog } from './invoice-user-dialog'
import { OobPayDialog } from './oob-pay-dialog'
import { useLifetimeSpend } from './lifetime-spend'

export type UserInvoiceRow = {
  id: string
  number: string | null
  status: string | null
  amountDue: number
  amountPaid: number
  amountRemaining: number
  currency: string
  created: number
  dueDate: number | null
  hostedInvoiceUrl: string | null
  description: string | null
  credits: number
  creditType: string | null
}

interface UserInvoicesCardProps {
  userId: number
  userEmail: string
  userName?: string
  userBrands: { id: number; name: string }[]
}

const PAGE_SIZE = 8

function formatCents(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function formatDate(epoch: number) {
  return new Date(epoch * 1000).toLocaleDateString()
}

function statusBadge(status: string | null) {
  const s = status || 'unknown'
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    void: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    uncollectible: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
        styles[s] || styles.draft
      }`}
    >
      {s}
    </span>
  )
}

export function UserInvoicesCard({
  userId,
  userEmail,
  userName,
  userBrands,
}: UserInvoicesCardProps) {
  const { setLifetimeSpend: setSharedLifetimeSpend } = useLifetimeSpend()
  const [invoices, setInvoices] = useState<UserInvoiceRow[]>([])
  const [lifetimeSpend, setLifetimeSpend] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [oobInvoice, setOobInvoice] = useState<UserInvoiceRow | null>(null)

  const applyLifetimeSpend = useCallback(
    (cents: number | undefined, updatedAt?: string | Date | null) => {
      if (typeof cents !== 'number') return
      setLifetimeSpend(cents)
      setSharedLifetimeSpend(cents, updatedAt ?? new Date())
    },
    [setSharedLifetimeSpend],
  )

  const loadInvoices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${userId}/invoice`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to load invoices')
        setInvoices([])
        setPage(0)
        return
      }
      setInvoices(data.invoices || [])
      applyLifetimeSpend(data.lifetimeSpend, data.lifetimeSpendUpdatedAt)
      setPage(0)
    } catch {
      setError('Failed to load invoices')
      setInvoices([])
      setPage(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [userId, applyLifetimeSpend])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  const handleDelete = async (inv: UserInvoiceRow) => {
    const label = inv.number || inv.id.slice(-8)
    const action =
      inv.status === 'draft'
        ? `Permanently delete draft invoice ${label}?`
        : `Void invoice ${label}? This cannot be undone.`
    if (!confirm(action)) return

    setBusyId(inv.id)
    try {
      const res = await fetch(`/api/admin/users/${userId}/invoice/${inv.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete invoice')
        return
      }
      toast.success(
        inv.status === 'draft' ? `Deleted ${label}` : `Voided ${label}`,
      )
      applyLifetimeSpend(data.lifetimeSpend, data.lifetimeSpendUpdatedAt)
      await loadInvoices(true)
    } catch {
      toast.error('Failed to delete invoice')
    } finally {
      setBusyId(null)
    }
  }

  const handleOutOfBandPay = (inv: UserInvoiceRow) => {
    setOobInvoice(inv)
  }

  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageInvoices = useMemo(() => {
    const start = safePage * PAGE_SIZE
    return invoices.slice(start, start + PAGE_SIZE)
  }, [invoices, safePage])

  const rangeStart = invoices.length === 0 ? 0 : safePage * PAGE_SIZE + 1
  const rangeEnd = Math.min((safePage + 1) * PAGE_SIZE, invoices.length)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Invoices
            {!loading && (
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({invoices.length})
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {!loading && lifetimeSpend != null && (
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mr-1">
                Lifetime {formatCents(lifetimeSpend)}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => loadInvoices(true)}
              disabled={loading || refreshing}
              title="Refresh invoices"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <InvoiceUserDialog
              userId={userId}
              userEmail={userEmail}
              userName={userName}
              userBrands={userBrands}
              onSuccess={() => loadInvoices(true)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <OobPayDialog
          userId={userId}
          invoice={oobInvoice}
          open={!!oobInvoice}
          onOpenChange={(next) => {
            if (!next) setOobInvoice(null)
          }}
          onSuccess={(data) => {
            applyLifetimeSpend(data.lifetimeSpend, data.lifetimeSpendUpdatedAt)
            void loadInvoices(true)
          }}
        />
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading invoices…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No Stripe invoices for this user yet. Create one to email a payment request.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800">
                    <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Invoice</th>
                    <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                    <th className="text-right py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Amount</th>
                    <th className="text-left py-2 pr-3 font-medium text-gray-500 dark:text-gray-400">Created</th>
                    <th className="text-right py-2 font-medium text-gray-500 dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageInvoices.map((inv) => {
                    const remaining =
                      inv.amountRemaining > 0 ? inv.amountRemaining : inv.amountDue
                    const amount =
                      inv.status === 'paid'
                        ? inv.amountPaid
                        : inv.amountPaid > 0
                          ? remaining
                          : inv.amountDue
                    const busy = busyId === inv.id
                    const canDelete =
                      inv.status === 'draft' ||
                      ((inv.status === 'open' || inv.status === 'uncollectible') &&
                        inv.amountPaid === 0)
                    const canOob = inv.status === 'open' && remaining > 0
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <td className="py-2.5 pr-3 align-top">
                          <p className="font-mono text-xs text-gray-800 dark:text-gray-200">
                            {inv.number || inv.id.slice(-8)}
                          </p>
                          {(inv.credits > 0 || inv.description) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                              {inv.credits > 0
                                ? `${inv.credits} ${inv.creditType || 'pr'} credits`
                                : inv.description}
                            </p>
                          )}
                          {inv.status === 'open' && inv.amountPaid > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {formatCents(inv.amountPaid, inv.currency)} paid ·{' '}
                              {formatCents(remaining, inv.currency)} left
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 align-top">{statusBadge(inv.status)}</td>
                        <td className="py-2.5 pr-3 text-right align-top font-medium text-gray-900 dark:text-gray-100 text-xs">
                          {formatCents(amount, inv.currency)}
                        </td>
                        <td className="py-2.5 pr-3 align-top text-xs text-gray-500 dark:text-gray-400">
                          <div>{formatDate(inv.created)}</div>
                          {inv.dueDate && inv.status === 'open' && (
                            <div className="text-amber-600 dark:text-amber-400">
                              Due {formatDate(inv.dueDate)}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 text-right align-top">
                          <div className="inline-flex items-center justify-end gap-0.5">
                            {inv.hostedInvoiceUrl && (
                              <a
                                href={inv.hostedInvoiceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  disabled={busy}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </a>
                            )}
                            {canOob && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                                title="Record out-of-band payment"
                                disabled={busy}
                                onClick={() => handleOutOfBandPay(inv)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Banknote className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 text-red-600 hover:text-red-700 dark:text-red-400"
                                title={inv.status === 'draft' ? 'Delete draft' : 'Void invoice'}
                                disabled={busy}
                                onClick={() => handleDelete(inv)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {invoices.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {rangeStart}–{rangeEnd} of {invoices.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safePage <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-1 tabular-nums">
                    {safePage + 1} / {pageCount}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
