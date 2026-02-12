'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface ApprovalResponseProps {
  approvalUuid: string
  release: {
    title: string
    abstract: string
    body: string
    location: string
  }
  company: {
    name: string
    logoUrl: string | null
  }
  banner: {
    url: string
    caption: string | null
  } | null
  approverName: string
  notes: string | null
}

function formatDate() {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function ApprovalResponse({
  approvalUuid,
  release,
  company,
  banner,
  approverName,
  notes,
}: ApprovalResponseProps) {
  const [signature, setSignature] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<'approved' | 'declined' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (approved: boolean) => {
    if (!signature.trim()) {
      setError('Please enter your name as signature')
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
          approved,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit response')
      }

      setSubmitted(approved ? 'approved' : 'declined')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            {submitted === 'approved' ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Thank You!
          </h1>
          <p className="text-gray-600">
            {submitted === 'approved'
              ? 'Your approval has been recorded. The press release author has been notified.'
              : 'Your response has been recorded. The press release author has been notified.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Image
            src="/logo.svg"
            alt="Newsworthy"
            width={180}
            height={40}
            className="h-8 w-auto"
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Approval Request Banner */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-blue-900">Approval Requested</h2>
                <p className="text-blue-700 mt-1">
                  {approverName ? `Hi ${approverName}, your` : 'Your'} approval has been requested for the press release below.
                  Please review and provide your response.
                </p>
                {notes && (
                  <div className="mt-3 p-3 bg-white rounded-md border border-blue-200">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Message from requestor:</span> "{notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Press Release Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-gray-500 font-normal">Press Release Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <article className="space-y-6">
              {/* Company */}
              <div className="flex items-center gap-3">
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt={company.name}
                    width={48}
                    height={48}
                    className="rounded"
                    unoptimized
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-gray-400 text-xs">Logo</span>
                  </div>
                )}
                <span className="font-medium text-gray-900">{company.name}</span>
              </div>

              {/* Title */}
              <h1 className="font-serif text-2xl lg:text-3xl font-medium text-gray-900">
                {release.title}
              </h1>

              {/* Banner */}
              {banner && (
                <div className="relative aspect-[1200/630] w-full rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    src={banner.url}
                    alt={banner.caption || 'Press release banner'}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Abstract */}
              <p className="text-lg font-light text-gray-700">
                {release.abstract}
              </p>

              {/* Dateline */}
              <p className="text-gray-600">
                {release.location} (Newsworthy.ai) {formatDate()}
              </p>

              {/* Body */}
              <div
                className="prose prose-sm max-w-none prose-p:text-gray-800 prose-headings:text-gray-900 prose-a:text-blue-600"
                dangerouslySetInnerHTML={{ __html: release.body }}
              />
            </article>
          </CardContent>
        </Card>

        {/* Approval Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Response</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm flex items-center gap-2">
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

            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Add any comments or feedback..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={4}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                onClick={() => handleSubmit(true)}
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
                onClick={() => handleSubmit(false)}
                disabled={isSubmitting}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
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

            <p className="text-xs text-gray-500 text-center pt-2">
              By clicking Approve, you confirm that you have reviewed the press release
              and authorize its distribution.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 text-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm">
          <p>Newsworthy.ai - Press Release Distribution</p>
        </div>
      </footer>
    </div>
  )
}
