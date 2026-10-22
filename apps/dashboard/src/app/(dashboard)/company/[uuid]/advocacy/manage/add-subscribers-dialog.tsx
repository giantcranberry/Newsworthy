'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Send, UserPlus } from 'lucide-react'

// Same flow as Step 2 on the Share List page: adds the contacts and sends
// each new subscriber the brand's welcome email.
export function AddSubscribersDialog({ companyUuid }: { companyUuid: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [emails, setEmails] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setError(null)
      setSuccess(null)
    }
  }

  const handleAddSubscribers = async () => {
    if (!emails.trim()) {
      setError('Please enter at least one email address')
      return
    }

    setIsAdding(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add subscribers')
      }

      const data = await response.json()
      setSuccess(
        `Added ${data.added} subscriber${data.added !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} skipped — duplicates or invalid)` : ''}.` +
        (data.emailsSent ? ` Welcome email sent to ${data.emailsSent}.` : '') +
        (data.emailErrors ? ` ${data.emailErrors} welcome email${data.emailErrors !== 1 ? 's' : ''} failed to send.` : '')
      )
      setEmails('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subscribers')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="h-4 w-4" />
          Add Subscribers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Subscribers</DialogTitle>
          <DialogDescription>
            New subscribers are sent your Share List welcome email. Maximum 100 at a time.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{error}</div>
        )}
        {success && (
          <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 p-3 rounded-lg">{success}</div>
        )}

        <div>
          <Label htmlFor="add-subscriber-emails" className="font-semibold">Enter Email Addresses</Label>
          <Textarea
            id="add-subscriber-emails"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            rows={8}
            className="mt-1 font-mono text-sm"
            placeholder={"email@example.com,FirstName,LastName\nanother@example.com,John,Doe"}
          />
          <p className="text-xs text-gray-400 mt-1">
            One email per line. First and last names are optional but recommended for personalization.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {success ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={handleAddSubscribers} disabled={isAdding || !emails.trim()}>
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Welcome Emails
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
