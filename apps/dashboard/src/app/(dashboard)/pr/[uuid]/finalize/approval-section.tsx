'use client'

import { useEffect, useState } from 'react'
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
  Send,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Approval {
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

export interface PriorApprover {
  email: string | null
  emailTo: string | null
}

interface ApprovalSectionProps {
  releaseUuid: string
  approvals: Approval[]
  priorApprovers: PriorApprover[]
  onApprovalsChange?: (approvals: Approval[]) => void
  /** True when the user opted in and has not yet added any requests (blocks Ready to Submit). */
  onAwaitingApproversChange?: (awaiting: boolean) => void
}

const REASONS = [
  'Your press release includes stock ticker symbols',
  'Your press release announces mergers or acquisitions',
  'Your press release mentions a third-party company',
  'Your press release quotes or mentions a person material to the release',
  'You want a stakeholder to share responsibility for the release',
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
  approvals: approvalList,
  priorApprovers,
  onApprovalsChange,
  onAwaitingApproversChange,
}: ApprovalSectionProps) {
  const setApprovalList = (updater: Approval[] | ((prev: Approval[]) => Approval[])) => {
    const newList = typeof updater === 'function' ? updater(approvalList) : updater
    onApprovalsChange?.(newList)
  }

  // Opt into the approval flow when the user says yes, or when requests already exist
  const [approvalRequired, setApprovalRequired] = useState(approvalList.length > 0)
  const [selectedPrior, setSelectedPrior] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Parent hides Ready to Submit while opted-in with zero requests yet
  useEffect(() => {
    onAwaitingApproversChange?.(approvalRequired && approvalList.length === 0)
  }, [approvalRequired, approvalList.length, onAwaitingApproversChange])

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

      setApprovalList((prev) => [...prev, ...data.approvals])
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

      setApprovalList((prev) => prev.filter((a) => a.uuid !== approvalUuid))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCancel = () => {
    setApprovalRequired(false)
    setError(null)
    setSelectedPrior(new Set())
    setNewName('')
    setNewEmail('')
    setNotes('')
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
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Approval History</h3>
            <div className="flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
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

            <div className="divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
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
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {approval.email}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          {formatDate(approval.requestedAt)}
                        </span>
                        <button
                          onClick={() => handleDelete(approval.uuid)}
                          disabled={deletingId === approval.uuid}
                          className="text-red-400 hover:text-red-600 dark:text-red-400 disabled:opacity-50"
                          title="Delete request"
                        >
                          {deletingId === approval.uuid ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MinusCircle className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {isPending && (
                      <div className="ml-6 mt-1">
                        <a
                          href={`/approval/${approval.uuid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          View approval link →
                        </a>
                      </div>
                    )}
                    {approval.notes && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 ml-6">
                        Notes: {approval.notes}
                      </p>
                    )}
                    {approval.signedAt && (
                      <div className="ml-6 text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
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

        {!approvalRequired ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Is Stakeholder Approval Required?
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Stakeholder approval may be required if:
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-gray-700 dark:text-gray-300">
                {REASONS.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
            <Button onClick={() => setApprovalRequired(true)}>
              Yes — Stakeholder Approval Is Required
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Request Stakeholder Approval
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Add one or more stakeholders. Ready to Submit stays hidden until every
                  request is approved or deleted.
                </p>
              </div>
              {approvalList.length === 0 && (
                <Button variant="outline" onClick={handleCancel} className="shrink-0">
                  Cancel
                </Button>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {priorApprovers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-600 dark:text-gray-400">
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

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
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

            <p className="text-xs text-gray-600 dark:text-gray-400">
              The approval link will give the recipient access to view the full
              press release content. Only send to trusted stakeholders.
            </p>

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
      </CardContent>
    </Card>
  )
}
