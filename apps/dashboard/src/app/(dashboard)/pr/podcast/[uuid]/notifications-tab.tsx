'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Check, Mail, MessageSquareText, Bell, Slack, ArrowRight } from 'lucide-react'

interface NotificationsTabProps {
  feedUuid: string
  accountEmail: string
  initial: {
    notifyEmail: boolean
    notifyEmailTo: string | null
    notifySms: boolean
    notifySmsPhone: string | null
    notifyInApp: boolean
    notifySlack: boolean
    notifySlackWebhookUrl: string | null
    savedAt: string | null
  }
}

export function NotificationsTab({ feedUuid, accountEmail, initial }: NotificationsTabProps) {
  const router = useRouter()
  const [notifyEmail, setNotifyEmail] = useState(initial.notifyEmail)
  const [notifyEmailTo, setNotifyEmailTo] = useState(initial.notifyEmailTo || '')
  const [notifySms, setNotifySms] = useState(initial.notifySms)
  const [notifySmsPhone, setNotifySmsPhone] = useState(initial.notifySmsPhone || '')
  const [notifyInApp, setNotifyInApp] = useState(initial.notifyInApp)
  const [notifySlack, setNotifySlack] = useState(initial.notifySlack)
  const [notifySlackWebhookUrl, setNotifySlackWebhookUrl] = useState(
    initial.notifySlackWebhookUrl || '',
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState(initial.savedAt)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const res = await fetch(`/api/podcasts/feeds/${feedUuid}/notifications`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyEmail,
          notifyEmailTo: notifyEmailTo.trim() || null,
          notifySms,
          notifySmsPhone: notifySmsPhone.trim() || null,
          notifyInApp,
          notifySlack,
          notifySlackWebhookUrl: notifySlackWebhookUrl.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to save notifications')
      } else {
        setSavedAt(new Date().toISOString())
        // Saved — continue to the funding step.
        router.push(`/pr/podcast/${feedUuid}?tab=funding`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Notification preferences
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            How should we notify you when a podcast press release is generated and ready for review?
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Email */}
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Email</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Sends to your account email by default.
                  </p>
                </div>
              </div>
              <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} disabled={isSaving} />
            </div>
            {notifyEmail && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="emailTo" className="text-xs text-gray-600 dark:text-gray-400">
                  Override email (optional)
                </Label>
                <Input
                  id="emailTo"
                  type="email"
                  placeholder={accountEmail}
                  value={notifyEmailTo}
                  onChange={(e) => setNotifyEmailTo(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            )}
          </div>

          {/* SMS */}
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <MessageSquareText className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">SMS</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Text message via Twilio.
                  </p>
                </div>
              </div>
              <Switch checked={notifySms} onCheckedChange={setNotifySms} disabled={isSaving} />
            </div>
            {notifySms && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="smsPhone" className="text-xs text-gray-600 dark:text-gray-400">
                  Phone number
                </Label>
                <Input
                  id="smsPhone"
                  type="tel"
                  placeholder="+1 (555) 555-1234"
                  value={notifySmsPhone}
                  onChange={(e) => setNotifySmsPhone(e.target.value)}
                  disabled={isSaving}
                  required={notifySms}
                />
              </div>
            )}
          </div>

          {/* In-app */}
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">In-app</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Bell-icon notification inside the dashboard.
                  </p>
                </div>
              </div>
              <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} disabled={isSaving} />
            </div>
          </div>

          {/* Slack */}
          <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Slack className="mt-0.5 h-5 w-5 text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Slack</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Post to a Slack channel via incoming webhook.
                  </p>
                </div>
              </div>
              <Switch checked={notifySlack} onCheckedChange={setNotifySlack} disabled={isSaving} />
            </div>
            {notifySlack && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="slackUrl" className="text-xs text-gray-600 dark:text-gray-400">
                  Incoming webhook URL
                </Label>
                <Input
                  id="slackUrl"
                  type="url"
                  placeholder="https://hooks.slack.com/services/T000/B000/XXXX"
                  value={notifySlackWebhookUrl}
                  onChange={(e) => setNotifySlackWebhookUrl(e.target.value)}
                  disabled={isSaving}
                  required={notifySlack}
                />
                <p className="text-xs text-gray-400">
                  Create one at <code className="px-1">api.slack.com/apps</code> → Incoming Webhooks.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {savedAt ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  Saved {new Date(savedAt).toLocaleString()}
                </span>
              ) : (
                'Not saved yet'
              )}
            </div>
            <Button
              type="submit"
              disabled={isSaving}
              className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  Save &amp; Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
