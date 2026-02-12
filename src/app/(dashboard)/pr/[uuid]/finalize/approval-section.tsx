'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  Loader2,
  AlertTriangle,
  Send,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Approval {
  id: number
  uuid: string
  email: string | null
  emailTo: string | null
  signature: string | null
  requestedAt: string | null
  signedAt: string | null
  feedback: string | null
  approved: boolean
  notes: string | null
}

interface PriorApprover {
  email: string | null
  emailTo: string | null
}

interface ApprovalSectionProps {
  releaseUuid: string
  approvals: Approval[]
  priorApprovers: PriorApprover[]
}

const QUESTIONS = [
  {
    id: 'ticker',
    question: 'Does your press release include stock ticker symbols?',
    guidance:
      'Releases that include stock ticker symbols may be subject to SEC regulations. A qualified representative should review the release before distribution.',
  },
  {
    id: 'mergers',
    question: 'Does your press release announce mergers or acquisitions?',
    guidance:
      'Merger and acquisition announcements require careful review by legal counsel to ensure compliance with securities regulations and contractual obligations.',
  },
  {
    id: 'thirdparty',
    question: 'Does your press release mention a third party company?',
    guidance:
      'When mentioning third parties, it is best practice to get their approval before distribution to avoid potential disputes or misrepresentation claims.',
  },
  {
    id: 'person',
    question:
      'Does your press release quote or mention a person material to the release?',
    guidance:
      'Any person quoted or mentioned materially should review and approve the release to verify accuracy and grant permission for use of their name or likeness.',
  },
  {
    id: 'blame',
    question: 'Do you want to be blamed if there are problems with the release?',
    yesIsNo: true,
    guidance:
      'Having a stakeholder review and approve the release helps protect you from liability and ensures accuracy across all parties involved.',
  },
]

function formatDate(dateStr: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ApprovalSection({
  releaseUuid,
  approvals: initialApprovals,
  priorApprovers,
}: ApprovalSectionProps) {
  const [approvalList, setApprovalList] = useState<Approval[]>(initialApprovals)
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({})
  const [selectedPrior, setSelectedPrior] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const needsApproval = QUESTIONS.some((q) => {
    const answer = answers[q.id]
    if (!answer) return false
    if (q.yesIsNo) return answer === 'no'
    return answer === 'yes'
  })

  // Show form as soon as any triggering answer is given (matches Flask behavior)
  const showForm = needsApproval

  const handleAnswer = (questionId: string, value: 'yes' | 'no') => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const togglePriorApprover = (email: string) => {
    setSelectedPrior((prev) => {
      const next = new Set(prev)
      if (next.has(email)) {
        next.delete(email)
      } else {
        next.add(email)
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const priorSelections = priorApprovers.filter(
        (p) => p.email && selectedPrior.has(p.email)
      )

      const response = await fetch(`/api/pr/${releaseUuid}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail || undefined,
          emailTo: newName || undefined,
          notes: notes || undefined,
          priorApprovers: priorSelections.length > 0 ? priorSelections : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create approval request')
      }

      // Add new approvals to the list
      setApprovalList((prev) => [...prev, ...data.approvals])
      // Reset form
      setSelectedPrior(new Set())
      setNewName('')
      setNewEmail('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (approvalUuid: string) => {
    setDeletingId(approvalUuid)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/approval`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalUuid }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete approval')
      }

      // Optimistic removal
      setApprovalList((prev) => prev.filter((a) => a.uuid !== approvalUuid))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stakeholder Approval</CardTitle>
        <CardDescription>
          Request approval from stakeholders before distributing your release
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Approval History */}
        {approvalList.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Approval History</h3>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Approved
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-red-500" /> Not Approved
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-blue-500" /> Pending
              </span>
              <span className="flex items-center gap-1">
                <MinusCircle className="h-3.5 w-3.5 text-red-400" /> Delete
              </span>
            </div>

            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {approvalList.map((approval) => {
                const isPending = !approval.signedAt
                const isApproved = approval.approved && !!approval.signedAt

                return (
                  <div key={approval.uuid} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isApproved ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : isPending ? (
                          <Clock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm font-medium">
                          {approval.emailTo || 'Unknown'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {approval.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {formatDate(approval.requestedAt)}
                        </span>
                        {isPending && (
                          <button
                            onClick={() => handleDelete(approval.uuid)}
                            disabled={deletingId === approval.uuid}
                            className="text-red-400 hover:text-red-600 disabled:opacity-50"
                            title="Delete request"
                          >
                            {deletingId === approval.uuid ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MinusCircle className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {isPending && (
                      <div className="ml-6 mt-1">
                        <a
                          href={`/approval/${approval.uuid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View approval link →
                        </a>
                      </div>
                    )}
                    {approval.notes && (
                      <p className="text-xs text-gray-500 ml-6">
                        Notes: {approval.notes}
                      </p>
                    )}
                    {approval.signedAt && (
                      <div className="ml-6 text-xs text-gray-500 space-y-0.5">
                        {approval.signature && (
                          <p>Signature: {approval.signature}</p>
                        )}
                        <p>Responded: {formatDate(approval.signedAt)}</p>
                        {approval.feedback && (
                          <p>Feedback: {approval.feedback}</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Questionnaire */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Is Stakeholder Approval Required?
          </h2>
          <div className="space-y-3">
            {QUESTIONS.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-gray-700">{q.question}</p>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value="yes"
                        checked={answers[q.id] === 'yes'}
                        onChange={() => handleAnswer(q.id, 'yes')}
                        className="h-4 w-4 text-blue-600 border-gray-300"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={q.id}
                        value="no"
                        checked={answers[q.id] === 'no'}
                        onChange={() => handleAnswer(q.id, 'no')}
                        className="h-4 w-4 text-blue-600 border-gray-300"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>
                {/* Show guidance when the "triggering" answer is given */}
                {answers[q.id] &&
                  ((q.yesIsNo && answers[q.id] === 'no') ||
                    (!q.yesIsNo && answers[q.id] === 'yes')) && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-md text-xs text-amber-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{q.guidance}</span>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>

        {/* Approval Request Form */}
        {showForm && (
          <div className="space-y-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700">
              Request Approval
            </h3>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Prior Approvers */}
            {priorApprovers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600">
                  Previous approvers from this brand
                </Label>
                <div className="space-y-2">
                  {priorApprovers.map((prior) =>
                    prior.email ? (
                      <div
                        key={prior.email}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`prior-${prior.email}`}
                          checked={selectedPrior.has(prior.email)}
                          onCheckedChange={() =>
                            togglePriorApprover(prior.email!)
                          }
                        />
                        <label
                          htmlFor={`prior-${prior.email}`}
                          className="text-sm cursor-pointer"
                        >
                          {prior.emailTo ? (
                            <>
                              <span className="font-medium">
                                {prior.emailTo}
                              </span>{' '}
                              ({prior.email})
                            </>
                          ) : (
                            prior.email
                          )}
                        </label>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* New Approver */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <UserPlus className="h-4 w-4" />
                <span>Add new approver</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="approver-name">Name</Label>
                  <Input
                    id="approver-name"
                    placeholder="Approver name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="approver-email">Email</Label>
                  <Input
                    id="approver-email"
                    type="email"
                    placeholder="approver@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="approval-notes">Notes (optional)</Label>
              <Textarea
                id="approval-notes"
                placeholder="Add a message for the approver..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Warning */}
            <p className="text-xs text-gray-500">
              The approval link will give the recipient access to view the full
              press release content. Only send to trusted stakeholders.
            </p>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (selectedPrior.size === 0 && (!newEmail || !newName))
              }
              className={cn('w-full sm:w-auto')}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Save &amp; Send
                </>
              )}
            </Button>
          </div>
        )}

        {/* Message when all questions are answered and no approval needed */}
        {QUESTIONS.every((q) => answers[q.id]) && !needsApproval && (
          <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md text-sm">
            <CheckCircle2 className="h-4 w-4" />
            Based on your answers, stakeholder approval does not appear to be
            required. You may proceed with distribution.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
