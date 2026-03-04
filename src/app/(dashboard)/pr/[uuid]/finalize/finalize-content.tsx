'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Flag, Loader2, Check, AlertCircle } from 'lucide-react'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { ApprovalSection, type Approval, type PriorApprover } from './approval-section'

interface FinalizeContentProps {
  releaseUuid: string
  releaseTitle: string
  distribution: string | null
  initialApprovals: Approval[]
  priorApprovers: PriorApprover[]
  wizardNav?: React.ReactNode
}

export function FinalizeContent({
  releaseUuid,
  releaseTitle,
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

  // Shared approval state — updated by ApprovalSection via callback
  const [approvalList, setApprovalList] = useState<Approval[]>(initialApprovals)

  const hasBlockingApprovals = useMemo(
    () => approvalList.some((a) => !a.signedAt || (a.signedAt && !a.approved)),
    [approvalList]
  )

  const handleSubmit = async () => {
    if (!confirmed) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center py-8">
            <div className="bg-green-100 p-4 rounded-full mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              Press Release Submitted!
            </h3>
            <p className="text-green-700">
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

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full">
              <Flag className="h-6 w-6 text-blue-600" />
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
          <div className="p-4 bg-gray-50 rounded-lg space-y-2">
            <p className="text-sm text-gray-600">Press Release</p>
            <p className="font-medium text-gray-900">{releaseTitle}</p>
            <p className="text-sm text-gray-600 mt-2">Distribution</p>
            <p className="text-sm font-medium text-gray-900">
              {distribution === 'premium' && 'Premium Distribution'}
              {distribution === 'yahoo' && 'Yahoo Finance Distribution'}
              {distribution === 'standard' && 'Standard Distribution'}
              {!distribution && 'Standard Distribution'}
            </p>
          </div>

          <div className="border-t pt-4">
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                confirmed
                  ? 'border-emerald-600 bg-emerald-50'
                  : 'border-amber-300 bg-amber-50'
              }`}
              onClick={() => setConfirmed(!confirmed)}
            >
              <Checkbox
                id="confirm"
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                className="h-5 w-5 mt-0.5 border-2 border-gray-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 data-[state=checked]:text-white"
              />
              <Label htmlFor="confirm" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                I confirm that I have reviewed my press release and all information is accurate.
                I understand that once submitted, the release will be reviewed by Newsworthy.ai editors and distributed according to the selected options.
              </Label>
            </div>
          </div>

          {hasBlockingApprovals && (
            <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg">
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
              className={`flex-1 ${confirmed && !hasBlockingApprovals ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
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
