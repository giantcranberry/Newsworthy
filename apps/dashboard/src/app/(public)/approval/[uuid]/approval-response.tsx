'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2, PencilLine } from 'lucide-react'
import { ReleaseSitePreview, type SitePreviewProps } from './release-site-preview'

type Decision = 'approved' | 'changes' | 'declined'

interface ApprovalResponseProps {
  approvalUuid: string
  company: {
    name: string
    logoUrl: string | null
  }
  preview: SitePreviewProps
  approverName: string
  notes: string | null
}

export function ApprovalResponse({
  approvalUuid,
  company,
  preview,
  approverName,
  notes,
}: ApprovalResponseProps) {
  const [signature, setSignature] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<Decision | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (decision: Decision) => {
    if (!signature.trim()) {
      setError('Please enter your name as signature')
      return
    }
    if (decision === 'changes' && !feedback.trim()) {
      setError('Please describe your changes in the Feedback area, then click Approve with Changes')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/approval/${approvalUuid}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: signature.trim(),
          feedback: feedback.trim() || null,
          approved: decision !== 'declined',
          withChanges: decision === 'changes',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit response')
      }

      setSubmitted(decision)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            {submitted === 'approved' ? (
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            ) : submitted === 'changes' ? (
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto">
                <PencilLine className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Thank You!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {submitted === 'approved'
              ? 'Your approval has been recorded. The press release author has been notified.'
              : submitted === 'changes'
              ? 'Your approval and requested changes have been recorded. The press release author has been notified.'
              : 'Your response has been recorded. The press release author has been notified.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt={company.name}
              width={180}
              height={40}
              className="h-10 w-auto max-w-[220px] object-contain"
              unoptimized
            />
          ) : (
            <Image
              src="/logo.svg"
              alt="Newsworthy"
              width={180}
              height={40}
              className="h-8 w-auto"
            />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Approval Request Banner */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Approval Requested</h2>
                <p className="text-blue-700 dark:text-blue-400 mt-1">
                  {approverName ? `Hi ${approverName}, your` : 'Your'} approval has been requested for the press release below.
                  Please review and provide your response.
                </p>
                {notes && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-md border border-blue-200">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Message from requestor:</span> "{notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Your Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 dark:text-red-400 rounded-md text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="signature">Your Name (Signature) *</Label>
              <Input
                id="signature"
                placeholder="Enter your full name"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
              />
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              You can provide changes in the Feedback area below and then <span className="font-medium text-gray-900 dark:text-gray-100">Approve with Changes</span>.
            </p>

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Add any comments, or list the changes you need..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={() => handleSubmit('approved')}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSubmit('changes')}
                disabled={isSubmitting}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <PencilLine className="h-4 w-4 mr-2" />
                    Approve with Changes
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleSubmit('declined')}
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
              By clicking Approve or Approve with Changes, you confirm that you have reviewed the press release
              and authorize its distribution.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Press Release Preview: full page width, sized like the article page container on newsworthy.ai */}
      <section className="bg-white border-y border-gray-200">
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 pt-6 pb-5 lg:pb-10">
          <p className="text-sm text-gray-500 mb-6">Press Release Preview</p>
          <ReleaseSitePreview {...preview} />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-800 text-white mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm">
          <p>Newsworthy.ai - Press Release Distribution</p>
        </div>
      </footer>
    </div>
  )
}
