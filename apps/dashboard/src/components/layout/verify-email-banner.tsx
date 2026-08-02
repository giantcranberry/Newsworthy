'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MailWarning, Loader2, X } from 'lucide-react'

// Shown at the release submission step while the signed-in user's email is
// unverified. Advisory only — submission is never blocked; the finalize
// route re-sends a fresh verification link after an unverified submit.
export function VerifyEmailBanner({ email: initialEmail }: { email: string }) {
  const [email, setEmail] = useState(initialEmail)
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  if (dismissed) return null

  const send = async (correctedEmail?: string) => {
    setSending(true)
    setStatus(null)
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(correctedEmail ? { newEmail: correctedEmail } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      if (data.verified) {
        setDismissed(true)
        return
      }
      if (data.email) setEmail(data.email)
      setEditing(false)
      setNewEmail('')
      setStatus('Verification link sent — check your inbox.')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4">
      <div className="flex items-start gap-3">
        <MailWarning className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-amber-900 dark:text-amber-300">
            <strong>Please verify your email address.</strong> We sent a link to{' '}
            <strong>{email}</strong> — verifying keeps your account secure and makes sure you
            receive editorial updates about your releases. You can submit in the meantime.
          </p>
          {status && (
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">{status}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {editing ? (
              <>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="correct@email.com"
                  className="h-8 w-64 bg-white dark:bg-gray-900"
                />
                <Button
                  size="sm"
                  onClick={() => send(newEmail)}
                  disabled={sending || !newEmail.trim()}
                >
                  {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Update &amp; resend
                </Button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="text-sm text-amber-800 dark:text-amber-400 underline"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => send()} disabled={sending}>
                  {sending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Resend link
                </Button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm text-amber-800 dark:text-amber-400 underline"
                >
                  Wrong email?
                </button>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
