'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Prefill values when duplicating (or editing a draft before send). */
export type InvoiceFormPrefill = {
  description?: string
  quantity?: number
  unitPriceDollars?: number
  credits?: number
  creditType?: string
  companyId?: number | null
  memo?: string | null
  /** Shown in dialog title, e.g. invoice number being duplicated. */
  sourceLabel?: string
}

interface InvoiceUserDialogProps {
  userId: number
  userEmail: string
  userName?: string
  userBrands: { id: number; name: string }[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, form is seeded from this invoice (duplicate-with-edit). */
  prefill?: InvoiceFormPrefill | null
  onSuccess?: () => void
}

/** Local calendar YYYY-MM-DD (avoids UTC shift from toISOString). */
function localYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function defaultDueDateYmd() {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return localYmd(d)
}

function applyPrefill(
  prefill: InvoiceFormPrefill | null | undefined,
  userBrands: { id: number; name: string }[],
) {
  const defaultBrand = userBrands.length === 1 ? String(userBrands[0].id) : ''
  const creditType =
    prefill?.creditType && prefill.creditType !== ''
      ? prefill.creditType
      : 'none'
  const credits =
    creditType === 'none'
      ? '0'
      : String(Math.max(0, Math.floor(prefill?.credits ?? 0)) || '1')
  const companyId =
    prefill?.companyId != null && Number.isFinite(prefill.companyId)
      ? String(prefill.companyId)
      : defaultBrand

  return {
    description: prefill?.description?.trim() || '',
    quantity: String(Math.max(1, Math.floor(prefill?.quantity ?? 1))),
    unitPrice:
      prefill?.unitPriceDollars != null &&
      Number.isFinite(prefill.unitPriceDollars) &&
      prefill.unitPriceDollars > 0
        ? String(prefill.unitPriceDollars)
        : '',
    credits,
    creditType,
    companyId,
    dueDate: defaultDueDateYmd(),
    memo: prefill?.memo?.trim() || '',
  }
}

export function InvoiceUserDialog({
  userId,
  userEmail,
  userName,
  userBrands,
  open,
  onOpenChange,
  prefill,
  onSuccess,
}: InvoiceUserDialogProps) {
  const isDuplicate = !!prefill
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [credits, setCredits] = useState('0')
  const [creditType, setCreditType] = useState('none')
  const [companyId, setCompanyId] = useState(
    userBrands.length === 1 ? String(userBrands[0].id) : '',
  )
  const [dueDate, setDueDate] = useState(defaultDueDateYmd)
  const [memo, setMemo] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const minDueDate = localYmd()

  // Seed / reset whenever the dialog opens (create or duplicate)
  useEffect(() => {
    if (!open) return
    const seeded = applyPrefill(prefill, userBrands)
    setDescription(seeded.description)
    setQuantity(seeded.quantity)
    setUnitPrice(seeded.unitPrice)
    setCredits(seeded.credits)
    setCreditType(seeded.creditType)
    setCompanyId(seeded.companyId)
    setDueDate(seeded.dueDate)
    setMemo(seeded.memo)
    setResultUrl(null)
  }, [open, prefill, userBrands])

  const qtyNum = Math.max(1, Math.floor(Number(quantity) || 1))
  const unitNum = Number(unitPrice)
  const totalAmount = useMemo(() => {
    if (!Number.isFinite(unitNum) || unitNum <= 0) return null
    return Math.round(qtyNum * unitNum * 100) / 100
  }, [qtyNum, unitNum])

  const grantCredits = creditType !== 'none'
  const creditsNum = grantCredits ? Math.max(0, Math.floor(Number(credits) || 0)) : 0

  const handleOpenChange = (next: boolean) => {
    if (isSubmitting) return
    onOpenChange(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (totalAmount == null || totalAmount <= 0) {
      toast.error('Enter a valid unit price')
      return
    }
    if (!dueDate || dueDate < localYmd()) {
      toast.error('Due date must be today or later')
      return
    }
    if (grantCredits && creditsNum < 1) {
      toast.error('Enter how many credits to grant, or set credit type to None')
      return
    }
    if (grantCredits && creditType === 'podcast_pr' && !companyId) {
      toast.error('Podcast PR credits must be assigned to a brand')
      return
    }

    setIsSubmitting(true)
    setResultUrl(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          quantity: qtyNum,
          unitPrice: unitNum,
          description,
          credits: creditsNum,
          creditType: grantCredits ? creditType : 'none',
          companyId: grantCredits ? companyId || null : null,
          dueDate,
          memo,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Failed to create invoice')
        setIsSubmitting(false)
        return
      }

      toast.success(
        data.invoiceNumber
          ? `Invoice ${data.invoiceNumber} sent to ${userEmail}`
          : `Invoice sent to ${userEmail}`,
      )
      onSuccess?.()
      setResultUrl(data.hostedInvoiceUrl || null)
      if (!data.hostedInvoiceUrl) {
        onOpenChange(false)
      }
    } catch {
      toast.error('Failed to create invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isDuplicate
              ? `Duplicate invoice${prefill?.sourceLabel ? ` ${prefill.sourceLabel}` : ''}`
              : `Invoice ${userName || userEmail}`}
          </DialogTitle>
          <DialogDescription>
            {isDuplicate ? (
              <>
                Prefills from the previous invoice — edit anything, then create &amp; send a new
                Stripe invoice to{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{userEmail}</span>.
                Due date defaults to 14 days from today.
              </>
            ) : (
              <>
                Emails a Stripe invoice to{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{userEmail}</span>.
                Leave credits at 0 for consulting, writing, or other ad-hoc work.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {resultUrl ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Invoice emailed successfully. You can also share the hosted invoice link:
            </p>
            <a
              href={resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              Open hosted invoice
            </a>
            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invoice-description">Line item description</Label>
              <Input
                id="invoice-description"
                required
                minLength={3}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="WRITE 1 PRESS RELEASE"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Short label shown in the invoice table (Qty × Unit price).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="invoice-qty">Quantity</Label>
                <Input
                  id="invoice-qty"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-unit">Unit price (USD)</Label>
                <Input
                  id="invoice-unit"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="150.00"
                />
              </div>
            </div>

            <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-sm flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Line total</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {totalAmount != null
                  ? totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                  : '—'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="invoice-memo">Invoice notes / breakdown</Label>
                <span className="text-xs text-gray-400">{memo.length}/5,000</span>
              </div>
              <Textarea
                id="invoice-memo"
                rows={10}
                maxLength={5000}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder={`JULY Writing ($150 each):\nOrgana (3)\nTNT (3)\n...\n\nYahoo Comps (Value $1,360):\n...`}
                className="font-mono text-xs leading-relaxed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Shown as the memo on the Stripe invoice (above the line items). Optional for simple
                invoices; use it for client lists and ad-hoc detail.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-due">Due date</Label>
              <Input
                id="invoice-due"
                type="date"
                required
                min={minDueDate}
                value={dueDate}
                onChange={(e) => {
                  const next = e.target.value
                  const today = localYmd()
                  if (next && next < today) {
                    toast.error('Due date must be today or later')
                    setDueDate(today)
                    return
                  }
                  setDueDate(next)
                }}
              />
            </div>

            <fieldset className="rounded-md border border-gray-200 dark:border-gray-800 p-3 space-y-3">
              <legend className="px-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                Platform credits
              </legend>
              <div className="space-y-2">
                <Label htmlFor="invoice-credit-type">Credit type</Label>
                <Select
                  id="invoice-credit-type"
                  value={creditType}
                  onChange={(e) => {
                    const next = e.target.value
                    setCreditType(next)
                    if (next === 'none') setCredits('0')
                    else if (credits === '0') setCredits('1')
                  }}
                >
                  <option value="none">None — no platform credits</option>
                  <option value="pr">Press Release</option>
                  <option value="yahoo">Yahoo News</option>
                  <option value="enhanced">Enhanced Distribution</option>
                  <option value="podcast_pr">Podcast PR</option>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Choose None for consulting, writing, or other ad-hoc work. Payment is still recorded
                  when paid.
                </p>
              </div>

              {grantCredits && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-credits">Credits on payment</Label>
                    <Input
                      id="invoice-credits"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={credits}
                      onChange={(e) => setCredits(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoice-brand">Assign credits to brand</Label>
                    <Select
                      id="invoice-brand"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                    >
                      <option value="">Account-level credits</option>
                      {userBrands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </Select>
                    {creditType === 'podcast_pr' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Podcast PR credits require a brand.
                      </p>
                    )}
                  </div>
                </>
              )}
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || totalAmount == null}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : isDuplicate ? (
                  'Create & Send Duplicate'
                ) : (
                  'Create & Send Invoice'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Trigger button for creating a blank invoice (dialog owned by parent). */
export function InvoiceUserTrigger({
  onClick,
  disabled,
}: {
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={disabled} className="gap-2">
      <FileText className="h-4 w-4" />
      Invoice User
    </Button>
  )
}
