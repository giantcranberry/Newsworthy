'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Flag, Loader2, Check, AlertCircle, Clock } from 'lucide-react'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { ApprovalSection, type Approval, type PriorApprover } from './approval-section'

function formatDateForInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatTimeForInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function getMinDate(): string {
  const d = new Date(Date.now() + 12 * 60 * 60 * 1000)
  return formatDateForInput(d)
}

interface FinalizeContentProps {
  releaseUuid: string
  releaseTitle: string
  releaseAt: string | null
  distribution: string | null
  initialApprovals: Approval[]
  priorApprovers: PriorApprover[]
  wizardNav?: React.ReactNode
}

export function FinalizeContent({
  releaseUuid,
  releaseTitle,
  releaseAt,
  distribution,
  initialApprovals,
  priorApprovers,
  wizardNav,
}: FinalizeContentProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Release date/time state
  const initialDate = releaseAt ? new Date(releaseAt) : null
  const [releaseDateStr, setReleaseDateStr] = useState(initialDate ? formatDateForInput(initialDate) : '')
  const [releaseTimeStr, setReleaseTimeStr] = useState(initialDate ? formatTimeForInput(initialDate) : '')

  // Shared approval state — updated by ApprovalSection via callback
  const [approvalList, setApprovalList] = useState<Approval[]>(initialApprovals)

  const hasBlockingApprovals = useMemo(
    () => approvalList.some((a) => !a.signedAt || (a.signedAt && !a.approved)),
    [approvalList]
  )

  const releaseDateTooSoon = useMemo(() => {
    if (!releaseDateStr || !releaseTimeStr) return false
    const selected = new Date(`${releaseDateStr}T${releaseTimeStr}:00`)
    const twelveHoursFromNow = new Date(Date.now() + 12 * 60 * 60 * 1000)
    return selected < twelveHoursFromNow
  }, [releaseDateStr, releaseTimeStr])

  const handleSubmit = async () => {
    if (!confirmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, any> = {}
      if (releaseDateStr && releaseTimeStr) {
        payload.releaseAt = new Date(`${releaseDateStr}T${releaseTimeStr}:00`).toISOString()
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
        title="Finalize"
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

      {releaseDateTooSoon && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium">Your release date is less than 12 hours away</p>
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              The release date will be automatically adjusted to 12 hours from the time of submission to allow for editorial review.
              If you need to expedite your distribution, please contact support.
            </p>
          </div>
        </div>
      )}

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
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="date"
                value={releaseDateStr}
                min={getMinDate()}
                onChange={(e) => setReleaseDateStr(e.target.value)}
                className="w-auto text-sm h-8"
              />
              <Input
                type="time"
                value={releaseTimeStr}
                onChange={(e) => setReleaseTimeStr(e.target.value)}
                className="w-auto text-sm h-8"
              />
              {releaseDateTooSoon && (
                <span className="text-xs text-amber-600 dark:text-amber-400">Will be adjusted to 12h out</span>
              )}
            </div>
          </div>

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
              disabled={!confirmed || isSubmitting || hasBlockingApprovals}
              className={`flex-1 ${confirmed && !hasBlockingApprovals ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
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
