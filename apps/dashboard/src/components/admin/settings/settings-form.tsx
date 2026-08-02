'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

const FREE_FIRST_PR_KEY = 'free_first_pr_enabled'

export function SettingsForm({ initialFreeFirstPr }: { initialFreeFirstPr: boolean }) {
  const [freeFirstPr, setFreeFirstPr] = useState(initialFreeFirstPr)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const toggleFreeFirstPr = async (checked: boolean) => {
    const previous = freeFirstPr
    setFreeFirstPr(checked)
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: FREE_FIRST_PR_KEY, value: checked }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }
      setStatus('Saved')
    } catch (err) {
      setFreeFirstPr(previous)
      setStatus(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New User Offers</CardTitle>
        <CardDescription>Incentives granted automatically at registration</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-6">
          <div>
            <Label htmlFor="free-first-pr" className="text-base font-medium text-gray-900 dark:text-gray-100">
              First press release free
            </Label>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              While enabled, any registered user with zero PR credits and no press releases
              submits their first release free — the credit is granted and consumed at
              submission (ledger notes &ldquo;first release free&rdquo; + &ldquo;editorial
              submit&rdquo;). Eligibility is checked live, so turning this off ends the offer
              immediately for anyone who hasn&rsquo;t redeemed it.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
            {status && !saving && (
              <span className={`text-xs ${status === 'Saved' ? 'text-emerald-600' : 'text-red-600'}`}>
                {status}
              </span>
            )}
            <Switch
              id="free-first-pr"
              checked={freeFirstPr}
              onCheckedChange={toggleFreeFirstPr}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
