'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'wire', label: 'Wire transfer' },
  { value: 'ach', label: 'ACH / bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'card_offstripe', label: 'Card (off Stripe)' },
  { value: 'other', label: 'Other' },
] as const

function formatCents(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

function centsToDollarsInput(cents: number) {
  return (cents / 100).toFixed(2)
}

export type OobInvoiceTarget = {
  id: string
  number: string | null
  currency: string
  amountDue: number
  amountPaid: number
  amountRemaining: number
}

interface OobPayDialogProps {
  userId: number
  invoice: OobInvoiceTarget | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (data: {
    lifetimeSpend?: number
    lifetimeSpendUpdatedAt?: string | Date
  }) => void
}

export function OobPayDialog({
  userId,
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: OobPayDialogProps) {
  const remainingCents = invoice
    ? invoice.amountRemaining > 0
      ? invoice.amountRemaining
      : invoice.amountDue
    : 0

  const [paymentMethod, setPaymentMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !invoice) return
    setPaymentMethod('')
    setAmount(centsToDollarsInput(remainingCents))
    setReference('')
  }, [open, invoice, remainingCents])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invoice) return

    if (!paymentMethod) {
      toast.error('Select how you were paid')
      return
    }

    const dollars = Number(amount)
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    const amountCents = Math.round(dollars * 100)
    if (amountCents > remainingCents) {
      toast.error(
        `Amount cannot exceed remaining balance (${formatCents(remainingCents, invoice.currency)})`,
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/invoice/${invoice.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_out_of_band',
          paymentMethod,
          amount: dollars,
          reference: reference.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to record payment')
        return
      }

      const label = invoice.number || invoice.id.slice(-8)
      const paidLabel = formatCents(amountCents, invoice.currency)
      if (data.status === 'paid') {
        toast.success(`Marked ${label} paid (${paidLabel} via ${paymentMethod})`)
      } else {
        toast.success(
          `Recorded ${paidLabel} on ${label}; ${formatCents(data.amountRemaining ?? 0, invoice.currency)} remaining`,
        )
      }
      onSuccess(data)
      onOpenChange(false)
    } catch {
      toast.error('Failed to record payment')
    } finally {
      setIsSubmitting(false)
    }
  }

  const invoiceLabel = invoice?.number || invoice?.id.slice(-8) || 'invoice'

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Record out-of-band payment</DialogTitle>
            <DialogDescription>
              Invoice {invoiceLabel}
              {invoice
                ? ` · ${formatCents(remainingCents, invoice.currency)} remaining`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oob-method">How were you paid?</Label>
              <Select
                id="oob-method"
                required
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="" disabled>
                  Select payment method…
                </option>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oob-amount">Amount paid (USD)</Label>
              <Input
                id="oob-amount"
                type="number"
                min="0.01"
                step="0.01"
                max={(remainingCents / 100).toFixed(2)}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Enter less than the balance for a partial payment. Max{' '}
                {invoice ? formatCents(remainingCents, invoice.currency) : '—'}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="oob-ref">Reference (optional)</Label>
              <Input
                id="oob-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Check #, wire confirmation, etc."
                maxLength={200}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !paymentMethod}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Recording…
                </>
              ) : (
                'Record payment'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
