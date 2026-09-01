'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClipboardList, Loader2, Plus, Trash2 } from 'lucide-react'

export interface ClipReportRecipient {
  id: number
  email: string
  name: string | null
  isPrimaryContact: boolean
  createdAt: string | Date
}

const MAX_RECIPIENTS = 6

interface ClipReportRecipientsSectionProps {
  releaseUuid: string
  initialRecipients: ClipReportRecipient[]
}

export function ClipReportRecipientsSection({
  releaseUuid,
  initialRecipients,
}: ClipReportRecipientsSectionProps) {
  const [recipients, setRecipients] = useState(initialRecipients)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const atMax = recipients.length >= MAX_RECIPIENTS

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (atMax) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/clip-report-recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add recipient')
      }
      setRecipients((prev) => [...prev, data])
      setEmail('')
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add recipient')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: number) => {
    setDeletingId(id)
    setError(null)
    try {
      const res = await fetch(
        `/api/pr/${releaseUuid}/clip-report-recipients/${id}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove recipient')
      }
      setRecipients((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove recipient')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-full">
            <ClipboardList className="h-6 w-6 text-violet-700 dark:text-violet-400" />
          </div>
          <div>
            <CardTitle>Clipping Report?</CardTitle>
            <CardDescription>
              Add recipients below. Account holder and recipients in this list
              will receive a copy of the report.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {recipients.length > 0 && (
          <ul className="divide-y dark:divide-gray-800 rounded-lg border dark:border-gray-800">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {recipient.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {recipient.name ||
                      (recipient.isPrimaryContact ? 'PR contact' : 'Recipient')}
                    {recipient.isPrimaryContact && recipient.name
                      ? ' · PR contact'
                      : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-gray-500 hover:text-red-600 cursor-pointer shrink-0"
                  onClick={() => handleRemove(recipient.id)}
                  disabled={deletingId === recipient.id}
                  aria-label={`Remove ${recipient.email}`}
                >
                  {deletingId === recipient.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {atMax ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Maximum of {MAX_RECIPIENTS} recipients reached. Remove one to add
            another.
          </p>
        ) : (
          <form
            onSubmit={handleAdd}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label htmlFor="clip-recipient-email">Email</Label>
              <Input
                id="clip-recipient-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clip-recipient-name">Name (optional)</Label>
              <Input
                id="clip-recipient-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                maxLength={128}
              />
            </div>
            <Button
              type="submit"
              disabled={saving || !email.trim()}
              className="cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </>
              )}
            </Button>
          </form>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400">
          {recipients.length} of {MAX_RECIPIENTS} recipients
          {' '}(PR contact plus up to 5 more)
        </p>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
