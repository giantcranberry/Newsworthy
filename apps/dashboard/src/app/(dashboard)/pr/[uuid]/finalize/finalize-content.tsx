'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Flag, Loader2, Check, AlertCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { ApprovalSection, type Approval, type PriorApprover } from './approval-section'
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

interface FinalizeContentProps {
  releaseUuid: string
  releaseTitle: string
  releaseAt: string | null
  releaseTimezone: string
  distribution: string | null
  initialApprovals: Approval[]
  priorApprovers: PriorApprover[]
  missingItems?: { label: string; path: string }[]
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
  missingItems = [],
  wizardNav,
}: FinalizeContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateError, setDateError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const hasBlockingApprovals = useMemo(
    () => approvalList.some((a) => !a.signedAt || (a.signedAt && !a.approved)),
    [approvalList]
  )

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
      />

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

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

          {hasBlockingApprovals && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-400 rounded-lg">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                You have pending or unapproved stakeholder approval requests. All approvals must be approved or deleted before you can submit.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!confirmed || isSubmitting || hasBlockingApprovals || !!dateError || missingItems.length > 0}
              className={`flex-1 ${confirmed && !hasBlockingApprovals && !dateError && missingItems.length === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
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
    </div>
  )
}
