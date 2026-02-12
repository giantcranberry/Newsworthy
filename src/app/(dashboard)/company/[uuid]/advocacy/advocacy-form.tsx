'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Info,
  Mail,
  UserPlus,
  Save,
  Loader2,
  Send,
  Users,
  ArrowRight,
} from 'lucide-react'

interface ShareListFormProps {
  companyUuid: string
  companyName: string
  group: {
    id: number
    inviteMsg: string
  }
  totalSubscribers: number
}

export function ShareListForm({
  companyUuid,
  companyName,
  group,
  totalSubscribers,
}: ShareListFormProps) {
  const router = useRouter()
  const [inviteMsg, setInviteMsg] = useState(group.inviteMsg)
  const [emails, setEmails] = useState('')
  const [isSavingMsg, setIsSavingMsg] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSaveMessage = async () => {
    setIsSavingMsg(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/advocacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteMsg }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save message')
      }

      setSuccess('Welcome message saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSavingMsg(false)
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
      setSuccess(`Added ${data.added} subscriber${data.added !== 1 ? 's' : ''}${data.skipped ? ` (${data.skipped} skipped — duplicates or invalid)` : ''}.`)
      setEmails('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add subscribers')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-500" />
            About Your Share List
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <p className="text-gray-700">
            Leverage your internal teams and stakeholders to amplify your company news in a controlled and measurable way.
          </p>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">How it works:</h4>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>Customize the welcome email below that will be sent to your subscribers</li>
              <li>Add email addresses for employees, partners, vendors and stakeholders</li>
              <li>Your welcome email will be sent one time to new subscribers</li>
              <li>Each new press release will notify subscribers with a custom tracking URL</li>
              <li>Track engagement through the subscriber list below</li>
            </ol>
          </div>
          <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg">
            You can create different Share Lists for each Brand Profile. Subscribers can unsubscribe at any time.
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Customize Welcome Email */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Step 1: Customize Your Welcome Email
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            When you add contacts to your Share List, we'll send them this welcome email. You can customize the message below.
          </p>

          <div>
            <Label className="font-semibold">Email Preview</Label>
            <div className="mt-1 bg-gray-50 border rounded-lg p-4 text-sm text-gray-700 space-y-3">
              <p>
                You have been added to the <u>{companyName}</u> Share List on Newsworthy.ai.
              </p>
              <p className="text-red-600">{inviteMsg}</p>
              <p>
                Sincerely,<br />
                {companyName}
              </p>
              <p className="text-xs text-gray-500">
                You can unsubscribe from this list at anytime by clicking the unsubscribe link below.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="inviteMsg" className="font-semibold">Customize Your Message</Label>
            <Textarea
              id="inviteMsg"
              value={inviteMsg}
              onChange={(e) => setInviteMsg(e.target.value)}
              rows={4}
              className="mt-1"
              placeholder="Enter your custom welcome message..."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveMessage} disabled={isSavingMsg}>
              {isSavingMsg ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Message
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Add Subscribers */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Step 2: Add Subscriber Email Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Format Options:</h4>
              <ul className="text-xs text-gray-500 space-y-0.5">
                <li><code className="bg-gray-100 px-1 rounded">email@example.com</code></li>
                <li><code className="bg-gray-100 px-1 rounded">email@example.com,FirstName</code></li>
                <li><code className="bg-gray-100 px-1 rounded">email@example.com,,LastName</code></li>
                <li><code className="bg-gray-100 px-1 rounded">email@example.com,FirstName,LastName</code></li>
              </ul>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800 font-semibold">Limits:</p>
              <ul className="text-xs text-amber-700 list-disc list-inside">
                <li>Maximum 100 subscribers at a time</li>
                <li>One email address per line</li>
              </ul>
            </div>
          </div>

          <div>
            <Label htmlFor="emails" className="font-semibold">Enter Email Addresses</Label>
            <Textarea
              id="emails"
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

          <div className="flex justify-end">
            <Button onClick={handleAddSubscribers} disabled={isAdding || !emails.trim()}>
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Welcome Emails
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Manage Subscribers */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900">
                  {totalSubscribers} Subscriber{totalSubscribers !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-gray-500">
                  View, edit, and manage your Share List members
                </p>
              </div>
            </div>
            <Link href={`/company/${companyUuid}/advocacy/manage`}>
              <Button variant="outline">
                Manage Subscribers
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
