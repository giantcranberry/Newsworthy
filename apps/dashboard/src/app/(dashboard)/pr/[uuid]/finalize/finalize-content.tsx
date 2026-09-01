'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Flag, Loader2, Check, AlertCircle, AlertTriangle, CreditCard, ShoppingCart } from 'lucide-react'
import Link from 'next/link'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { PaymentForm } from '@/components/stripe/payment-form'
import { getStripePublishableKey } from '@/lib/stripe-client'
import { ApprovalSection, type Approval, type PriorApprover } from './approval-section'
import {
  ClipReportRecipientsSection,
  type ClipReportRecipient,
} from './clip-report-recipients-section'
import { TIMEZONES, normalizeTimezone } from '@/lib/timezones'

/**
 * Convert a date string + time string in a given IANA timezone to a UTC Date.
 */
function toUTCFromTimezone(date: string, time: string, timezone: string): Date {
  const localStr = `${date}T${time}:00`
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const naive = new Date(localStr)
  const utcParts = formatter.formatToParts(naive)
  const get = (type: string) => utcParts.find((p) => p.type === type)?.value || '0'
  const inTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  )
  const offsetMs = inTz.getTime() - naive.getTime()
  return new Date(naive.getTime() - offsetMs)
}

/**
 * Validate whether a date+time in a timezone is at least 12 hours from now.
 */
function validateReleaseDateTime(date: string, time: string, timezone: string): string | null {
  if (!date || !time) return null
  const utcDate = toUTCFromTimezone(date, time, timezone)
  const minDateTime = new Date(Date.now() + 12 * 60 * 60 * 1000)
  if (utcDate < minDateTime) {
    return 'Release date must be at least 12 hours from now'
  }
  return null
}

/**
 * Format a UTC ISO date string into date/time parts in the given timezone.
 */
function formatInTimezone(isoDate: string, timezone: string): { date: string; time: string } {
  const d = new Date(isoDate)
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const h = parts.find((p) => p.type === 'hour')?.value || '09'
  const m = parts.find((p) => p.type === 'minute')?.value || '00'
  return { date: dateStr, time: `${h}:${m}` }
}

// What the user still owes before this release can be submitted: a PR credit
// and/or upgrades whose card payment was deferred at the Upgrades step. Both
// are settled here in a single payment.
export interface FinalizeCheckout {
  needsPrCredit: boolean
  prProduct: { name: string; price: number } | null
  pendingUpgrades: { type: string; name: string; price: number }[]
  total: number
}

interface FinalizeContentProps {
  releaseUuid: string
  releaseTitle: string
  releaseAt: string | null
  releaseTimezone: string
  distribution: string | null
  initialApprovals: Approval[]
  priorApprovers: PriorApprover[]
  initialClipRecipients: ClipReportRecipient[]
  missingItems?: { label: string; path: string }[]
  checkout?: FinalizeCheckout | null
  wizardNav?: React.ReactNode
}

export function FinalizeContent({
  releaseUuid,
  releaseTitle,
  releaseAt,
  releaseTimezone,
  distribution,
  initialApprovals,
  priorApprovers,
  initialClipRecipients,
  missingItems = [],
  checkout = null,
  wizardNav,
}: FinalizeContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Combined checkout state (PR credit + deferred upgrades in one payment)
  const [paid, setPaid] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)
  const [removingUpgrades, setRemovingUpgrades] = useState(false)

  const needsPayment =
    !!checkout && !paid && (checkout.needsPrCredit || checkout.pendingUpgrades.length > 0)

  useEffect(() => {
    if (!needsPayment) return
    const key = getStripePublishableKey()
    if (key) {
      setStripePromise(loadStripe(key))
    }
  }, [needsPayment])

  const startCheckout = async () => {
    setCheckoutLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_payment_intent' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout')
      setClientSecret(data.clientSecret)
      setPaymentIntentId(data.paymentIntentId)
      setPaymentAmount(data.amount)
      setShowPayment(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start checkout')
    } finally {
      setCheckoutLoading(false)
    }
  }

  const confirmCheckout = async (intentId: string) => {
    const res = await fetch(`/api/pr/${releaseUuid}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_payment', paymentIntentId: intentId }),
    })
    return res.json()
  }

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    setPaid(true)
  }

  // Drop the deferred upgrade selection (keeps the PR credit line if owed)
  const removeUpgrades = async () => {
    setRemovingUpgrades(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/distribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pending', productTypes: [] }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove upgrades')
      }
      // Server components recompute the checkout summary
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove upgrades')
    } finally {
      setRemovingUpgrades(false)
    }
  }

  // Timezone state
  const [timezone, setTimezone] = useState(releaseTimezone)

  // Release date/time state — display in the release's timezone
  // If the stored date is < 12 hours out, bump to the nearest hour that is >= 12h out
  const initial = (() => {
    if (!releaseAt) return null
    const parsed = formatInTimezone(releaseAt, releaseTimezone)
    if (!validateReleaseDateTime(parsed.date, parsed.time, releaseTimezone)) return parsed
    // Date is too soon — compute the minimum allowed time rounded up to the next hour
    const minUtc = new Date(Date.now() + 12 * 60 * 60 * 1000)
    // Round up to the next whole hour
    if (minUtc.getMinutes() > 0 || minUtc.getSeconds() > 0) {
      minUtc.setMinutes(0, 0, 0)
      minUtc.setHours(minUtc.getHours() + 1)
    }
    return formatInTimezone(minUtc.toISOString(), releaseTimezone)
  })()
  const [releaseDateStr, setReleaseDateStr] = useState(initial?.date || '')
  const [releaseTimeStr, setReleaseTimeStr] = useState(initial?.time || '')

  // Shared approval state — updated by ApprovalSection via callback
  const [approvalList, setApprovalList] = useState<Approval[]>(initialApprovals)
  // Opted into approval but has not added any requests yet
  const [awaitingApprovers, setAwaitingApprovers] = useState(false)

  const hasBlockingApprovals = useMemo(
    () => approvalList.some((a) => !a.signedAt || (a.signedAt && !a.approved)),
    [approvalList]
  )

  // Hide Ready to Submit while approvals are pending/rejected, or while the
  // user has opted in but not yet added any approvers.
  const hideReadyToSubmit = hasBlockingApprovals || awaitingApprovers

  const handleSubmit = async () => {
    if (!confirmed) return

    // Re-validate before submit
    if (releaseDateStr && releaseTimeStr) {
      const tzError = validateReleaseDateTime(releaseDateStr, releaseTimeStr, timezone)
      if (tzError) {
        setDateError(tzError)
        return
      }
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, any> = { timezone }
      if (releaseDateStr && releaseTimeStr) {
        payload.releaseAt = toUTCFromTimezone(releaseDateStr, releaseTimeStr, timezone).toISOString()
      }

      const response = await fetch(`/api/pr/${releaseUuid}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit release')
      }

      setSuccess(true)
      // Redirect to release page after short delay
      setTimeout(() => {
        router.push(`/pr/${releaseUuid}?wizard=complete`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold text-green-900 dark:text-green-300 mb-2">
              Press Release Submitted!
            </h3>
            <p className="text-green-700 dark:text-green-400">
              Your press release has been submitted for distribution. Redirecting...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <WizardHeader
        title="Submit"
        description="Submit your press release for editorial review and distribution"
        releaseUuid={releaseUuid}
        currentStep={8}
        hideNext
      />
      {wizardNav}

      <ApprovalSection
        releaseUuid={releaseUuid}
        approvals={approvalList}
        priorApprovers={priorApprovers}
        onApprovalsChange={setApprovalList}
        onAwaitingApproversChange={setAwaitingApprovers}
      />

      <ClipReportRecipientsSection
        releaseUuid={releaseUuid}
        initialRecipients={initialClipRecipients}
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {paid && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg">
          <Check className="h-5 w-5" />
          <span>Payment complete — you&apos;re ready to submit your press release.</span>
        </div>
      )}

      {needsPayment && checkout && (
        <Card className="border-cyan-600">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-cyan-100 dark:bg-cyan-900/30 p-2 rounded-full">
                <ShoppingCart className="h-6 w-6 text-cyan-700 dark:text-cyan-400" />
              </div>
              <div>
                <CardTitle>Complete Your Order</CardTitle>
                <CardDescription>
                  Your release is ready — one payment covers everything needed to publish it
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y dark:divide-gray-700 rounded-lg border dark:border-gray-700">
              {checkout.needsPrCredit && (
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {checkout.prProduct?.name || 'Press Release Credit'}
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {checkout.prProduct ? `$${(checkout.prProduct.price / 100).toFixed(0)}` : '—'}
                  </span>
                </div>
              )}
              {checkout.pendingUpgrades.map((u) => (
                <div key={u.type} className="flex items-center justify-between p-3">
                  <span className="text-sm text-gray-700 dark:text-gray-300">{u.name}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    ${(u.price / 100).toFixed(0)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-950">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Total</span>
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ${(checkout.total / 100).toFixed(0)}
                </span>
              </div>
            </div>

            {checkout.needsPrCredit && !checkout.prProduct ? (
              <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-400 rounded-lg">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">
                  Credit purchase is unavailable right now — please{' '}
                  <Link href="/payment/paygo" className="underline">
                    buy a credit from the store
                  </Link>{' '}
                  and return here to submit.
                </p>
              </div>
            ) : showPayment && clientSecret && stripePromise && paymentIntentId ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#2563eb',
                      borderRadius: '8px',
                    },
                  },
                }}
              >
                <PaymentForm
                  amount={paymentAmount}
                  onSuccess={handlePaymentSuccess}
                  onCancel={() => setShowPayment(false)}
                  releaseUuid={releaseUuid}
                  paymentIntentId={paymentIntentId}
                  confirmPayment={confirmCheckout}
                />
              </Elements>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Button onClick={startCheckout} disabled={checkoutLoading} size="lg">
                  {checkoutLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Preparing checkout...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay ${(checkout.total / 100).toFixed(0)} &amp; Unlock Submission
                    </>
                  )}
                </Button>
                {checkout.pendingUpgrades.length > 0 && (
                  <Button
                    variant="ghost"
                    onClick={removeUpgrades}
                    disabled={removingUpgrades || checkoutLoading}
                    className="text-gray-500 dark:text-gray-400"
                  >
                    {removingUpgrades ? 'Removing…' : 'Remove upgrades'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hideReadyToSubmit ? (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-300">
                  Ready to Submit is paused
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
                  {awaitingApprovers
                    ? 'Add at least one stakeholder approval request, or cancel if approval is not needed.'
                    : 'All stakeholder approval requests must be approved or deleted before you can submit.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-full">
              <Flag className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>Ready to Submit</CardTitle>
              <CardDescription>
                Submit your press release for editorial review and distribution
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-950 rounded-lg space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-400">Press Release</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">{releaseTitle}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Distribution</p>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {distribution === 'premium' && 'Premium Distribution'}
              {distribution === 'yahoo' && 'Yahoo Finance Distribution'}
              {distribution === 'standard' && 'Standard Distribution'}
              {!distribution && 'Standard Distribution'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Release Date</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Input
                type="date"
                value={releaseDateStr}
                onChange={(e) => {
                  const newDate = e.target.value
                  setReleaseDateStr(newDate)
                  setDateError(validateReleaseDateTime(newDate, releaseTimeStr, timezone))
                }}
                className="w-auto text-sm h-8"
              />
              <Input
                type="time"
                value={releaseTimeStr}
                onChange={(e) => {
                  const newTime = e.target.value
                  setReleaseTimeStr(newTime)
                  setDateError(validateReleaseDateTime(releaseDateStr, newTime, timezone))
                }}
                className="w-auto text-sm h-8"
              />
              <Select
                value={timezone}
                onChange={(e) => {
                  const newTz = e.target.value
                  // Convert current date/time from old tz to UTC, then display in new tz
                  if (releaseDateStr && releaseTimeStr) {
                    const utc = toUTCFromTimezone(releaseDateStr, releaseTimeStr, timezone)
                    const converted = formatInTimezone(utc.toISOString(), newTz)
                    setReleaseDateStr(converted.date)
                    setReleaseTimeStr(converted.time)
                    setDateError(validateReleaseDateTime(converted.date, converted.time, newTz))
                  }
                  setTimezone(newTz)
                }}
                className="w-auto text-sm h-8"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
            {dateError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{dateError}</p>
            )}
          </div>

          {missingItems.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Required items are incomplete
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                    Please complete the following before submitting:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {missingItems.map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.path}
                          className="text-sm text-amber-700 dark:text-amber-400 underline hover:text-amber-900 dark:hover:text-amber-200"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="border-t dark:border-gray-700 pt-4">
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                confirmed
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30'
              }`}
              onClick={() => setConfirmed(!confirmed)}
            >
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="h-5 w-5 mt-0.5 border-2 border-gray-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 data-[state=checked]:text-white"
              />
              <Label htmlFor="confirm" className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed cursor-pointer">
                I confirm that I have reviewed my press release and all information is accurate.
                I understand that once submitted, the release will be reviewed by Newsworthy.ai editors and distributed according to the selected options.
              </Label>
            </div>
          </div>

          {needsPayment && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Complete the payment in &ldquo;Complete Your Order&rdquo; above to enable submission.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!confirmed || isSubmitting || !!dateError || missingItems.length > 0 || needsPayment}
              className={`flex-1 ${confirmed && !dateError && missingItems.length === 0 && !needsPayment ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Flag className="h-4 w-4" />
                  Submit Press Release
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  )
}
