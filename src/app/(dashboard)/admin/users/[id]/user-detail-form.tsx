'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { KeyRound, Check, AlertCircle } from 'lucide-react'

interface Partner {
  id: number
  handle: string | null
  company: string | null
}

interface CreditTransaction {
  id: number
  companyId: number | null
  prId: number | null
  credits: number
  notes: string | null
  createdAt: Date
}

interface UserDetailFormProps {
  user: {
    id: number
    email: string
    isAdmin: boolean
    isEditor: boolean
    isStaff: boolean
    emailVerified: boolean | null
    referredBy: string | null
    partnerId: number | null
    imPartnerId: number | null
    profile: {
      firstName: string | null
      lastName: string | null
    } | null
    subscription: {
      newsdbCredits: number | null
    } | null
  }
  allPartners: Partner[]
  managedPartnerIds: number[]
  accountCredits: number
  creditHistory: CreditTransaction[]
  companies: Record<number, string>
  canResetPassword?: boolean
}

export function UserDetailForm({
  user,
  allPartners,
  managedPartnerIds: initialManagedPartnerIds,
  accountCredits,
  creditHistory,
  companies,
  canResetPassword,
}: UserDetailFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showCreditHistory, setShowCreditHistory] = useState(false)
  const [managedPartnerIds, setManagedPartnerIds] = useState<number[]>(initialManagedPartnerIds)

  // Password reset state
  const [newPassword, setNewPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [passwordResult, setPasswordResult] = useState<{ success?: boolean; error?: string } | null>(null)

  // Role state
  const [roles, setRoles] = useState({
    isAdmin: user.isAdmin,
    isEditor: user.isEditor,
    isStaff: user.isStaff,
  })
  const [emailVerified, setEmailVerified] = useState(user.emailVerified ?? false)

  const [formData, setFormData] = useState({
    firstName: user.profile?.firstName || '',
    lastName: user.profile?.lastName || '',
    referredBy: user.referredBy || '',
    prCredits: '',
    creditType: 'pr',
    creditNotes: '',
    newsdbCredits: user.subscription?.newsdbCredits?.toString() || '0',
    prPartner: user.partnerId?.toString() || '',
    imPartner: user.imPartnerId?.toString() || '',
  })

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordResult({ error: 'Password must be at least 8 characters' })
      return
    }

    setIsResettingPassword(true)
    setPasswordResult(null)

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetPassword: newPassword }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reset password')
      }

      setPasswordResult({ success: true })
      setNewPassword('')
      setTimeout(() => setPasswordResult(null), 3000)
    } catch (err) {
      setPasswordResult({ error: err instanceof Error ? err.message : 'An error occurred' })
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    const prCreditsNum = parseInt(formData.prCredits) || 0
    if (prCreditsNum !== 0 && !formData.creditNotes.trim()) {
      setError('Credit notes are required when adding or removing credits')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, managedPartnerIds, roles, emailVerified }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update user')
      }

      router.refresh()
      setFormData(prev => ({
        ...prev,
        prCredits: '',
        creditNotes: '',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Make Account Changes</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded text-sm">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          {canResetPassword && (
            <fieldset className="border border-gray-200 p-4 rounded-lg space-y-3">
              <legend className="text-sm font-medium text-gray-700 px-2">Roles & Status</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles.isAdmin}
                    onChange={(e) => setRoles({ ...roles, isAdmin: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm">
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">Admin</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles.isEditor}
                    onChange={(e) => setRoles({ ...roles, isEditor: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">Editor</span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roles.isStaff}
                    onChange={(e) => setRoles({ ...roles, isStaff: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm">
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">Staff</span>
                  </span>
                </label>
                <div className="w-px bg-gray-300" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailVerified}
                    onChange={(e) => setEmailVerified(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    emailVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {emailVerified ? 'Verified' : 'Pending'}
                  </span>
                </label>
              </div>
            </fieldset>
          )}

          <div>
            <Label htmlFor="referredBy">Referred By</Label>
            <Input
              id="referredBy"
              value={formData.referredBy}
              onChange={(e) => setFormData({ ...formData, referredBy: e.target.value })}
              className="mt-1"
            />
          </div>

          <fieldset className="border border-blue-200 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-blue-700 px-2">
              PR Credits Management
            </legend>

            <div className="bg-blue-50 p-3 rounded flex justify-between items-center">
              <span>
                <span className="text-gray-600">Current Account Credits:</span>{' '}
                <strong>{accountCredits.toLocaleString()}</strong>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreditHistory(!showCreditHistory)}
              >
                {showCreditHistory ? 'Hide' : 'View'} History
              </Button>
            </div>

            {showCreditHistory && (
              <div className="bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
                {creditHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No credit transactions</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1">Date</th>
                        <th className="text-left py-1">Type</th>
                        <th className="text-left py-1">Credits</th>
                        <th className="text-left py-1">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditHistory.map((tx) => (
                        <tr key={tx.id} className="border-b border-gray-200">
                          <td className="py-1">{new Date(tx.createdAt).toLocaleDateString()}</td>
                          <td className="py-1">
                            {tx.companyId ? (
                              <span className="text-blue-600">{companies[tx.companyId] || 'Brand'}</span>
                            ) : (
                              <span className="text-gray-500">Account</span>
                            )}
                          </td>
                          <td className={`py-1 font-medium ${tx.credits > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.credits > 0 ? '+' : ''}{tx.credits}
                          </td>
                          <td className="py-1 text-gray-500">{tx.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="prCredits">Add/Subtract PR Credits</Label>
              <Input
                id="prCredits"
                type="number"
                placeholder="0"
                value={formData.prCredits}
                onChange={(e) => setFormData({ ...formData, prCredits: e.target.value })}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Positive to add, negative to subtract (e.g., 10 or -5)
              </p>
            </div>

            <div>
              <Label htmlFor="creditType">Credit Type</Label>
              <Select
                id="creditType"
                value={formData.creditType}
                onChange={(e) => setFormData({ ...formData, creditType: e.target.value })}
                className="mt-1"
              >
                <option value="pr">PR Credits</option>
                <option value="yahoo">Yahoo News</option>
                <option value="enhanced">Enhanced Distribution</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="creditNotes">Credit Notes</Label>
              <Textarea
                id="creditNotes"
                placeholder="Required when adding/subtracting credits"
                rows={2}
                value={formData.creditNotes}
                onChange={(e) => setFormData({ ...formData, creditNotes: e.target.value })}
                className="mt-1"
              />
            </div>
          </fieldset>

          <div>
            <Label htmlFor="newsdbCredits">NewsDB Credits</Label>
            <Input
              id="newsdbCredits"
              type="number"
              value={formData.newsdbCredits}
              onChange={(e) => setFormData({ ...formData, newsdbCredits: e.target.value })}
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">This replaces existing credits</p>
          </div>

          <div>
            <Label>Partner Network Manager</Label>
            <MultiSelect
              options={allPartners.map((p) => ({
                value: p.id,
                label: p.handle || p.company || `Partner ${p.id}`,
              }))}
              selected={managedPartnerIds}
              onChange={setManagedPartnerIds}
              placeholder="Select partners to manage..."
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="prPartner">PR Partner</Label>
            <Select
              id="prPartner"
              value={formData.prPartner}
              onChange={(e) => setFormData({ ...formData, prPartner: e.target.value })}
              className="mt-1"
            >
              <option value="">None</option>
              {allPartners.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.handle || p.company || `Partner ${p.id}`}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="imPartner">IM Partner</Label>
            <Select
              id="imPartner"
              value={formData.imPartner}
              onChange={(e) => setFormData({ ...formData, imPartner: e.target.value })}
              className="mt-1"
            >
              <option value="">None</option>
              {allPartners.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.handle || p.company || `Partner ${p.id}`}
                </option>
              ))}
            </Select>
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </Button>
        </form>

        {canResetPassword && (
          <div className="mt-6 pt-6 border-t">
            <fieldset className="border border-amber-200 p-4 rounded-lg space-y-3">
              <legend className="text-sm font-medium text-amber-700 px-2 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4" />
                Reset Password
              </legend>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || newPassword.length < 8}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset'}
                </Button>
              </div>
              {passwordResult?.success && (
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded">
                  <Check className="h-4 w-4" />
                  Password reset successfully
                </div>
              )}
              {passwordResult?.error && (
                <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-2 rounded">
                  <AlertCircle className="h-4 w-4" />
                  {passwordResult.error}
                </div>
              )}
            </fieldset>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
