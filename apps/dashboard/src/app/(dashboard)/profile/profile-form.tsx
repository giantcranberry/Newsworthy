'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, Save, Lock, Eye, EyeOff, Building2, Plug, Calendar, MessageCircle, Camera, X } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileFormProps {
  email: string
  hasPassword: boolean
  avatar: string | null
  gravatarUrl: string
  isAgency: boolean
  initialData: {
    firstName: string
    lastName: string
    company: string
    phone: string
    mobile: string
    addr1: string
    addr2: string
    city: string
    state: string
    postalCode: string
    countryCode: string
  }
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
}

function handlePhoneChange(
  value: string,
  field: 'phone' | 'mobile',
  formData: ProfileFormProps['initialData'],
  setFormData: (data: ProfileFormProps['initialData']) => void
) {
  const formatted = formatPhoneNumber(value)
  setFormData({ ...formData, [field]: formatted })
}

export function ProfileForm({ email, hasPassword, avatar: initialAvatar, gravatarUrl, isAgency: initialIsAgency, initialData }: ProfileFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    ...initialData,
    phone: initialData.phone ? formatPhoneNumber(initialData.phone) : '',
    mobile: initialData.mobile ? formatPhoneNumber(initialData.mobile) : '',
  })
  const [isAgency, setIsAgency] = useState(initialIsAgency)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPG, and WebP files are supported')
      return
    }

    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData })
      const data = await res.json()
      if (res.ok) {
        setAvatarUrl(data.avatarUrl)
        toast.success('Avatar updated')
      } else {
        toast.error(data.error || 'Failed to upload avatar')
      }
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAvatarRemove = async () => {
    setAvatarUploading(true)
    try {
      const res = await fetch('/api/profile/avatar', { method: 'DELETE' })
      if (res.ok) {
        setAvatarUrl(null)
        toast.success('Avatar removed')
      } else {
        toast.error('Failed to remove avatar')
      }
    } catch {
      toast.error('Failed to remove avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  const [gravatarFailed, setGravatarFailed] = useState(false)

  const initial = formData.firstName
    ? formData.firstName.charAt(0).toUpperCase()
    : '?'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, isAgency }),
      })

      if (response.ok) {
        router.refresh()
        alert('Profile updated successfully')
      } else {
        const error = await response.json()
        alert(error.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="-mt-6 space-y-8 pb-16">
      {/* Sticky Action Bar */}
      <div data-tour="profile-actionbar" className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">Account Settings</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">Manage your profile and preferences</p>
          </div>
          <div data-tour="profile-save" className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <Card data-tour="profile-info">
        <CardHeader>
          <CardTitle>Profile Information <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(Who do we contact with regard to your account.)</span></CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4 pb-2">
            <div className="relative group">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:ring-offset-2"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : !gravatarFailed ? (
                  <img
                    src={gravatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                    onError={() => setGravatarFailed(true)}
                  />
                ) : (
                  <div className="h-full w-full bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center text-cyan-700 dark:text-cyan-300 text-xl font-semibold">
                    {initial}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  {avatarUploading ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
              {avatarUrl && !avatarUploading && (
                <button
                  type="button"
                  onClick={handleAvatarRemove}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 cursor-pointer shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Profile Photo</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Click to upload. PNG, JPG, or WebP. Max 5MB.</p>
            </div>
          </div>

          <div>
            <Label>Email</Label>
            <Input value={email} disabled className="mt-1 bg-gray-50 dark:bg-gray-950" />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div>
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handlePhoneChange(e.target.value, 'phone', formData, setFormData)}
                placeholder="(555) 555-1234"
                maxLength={14}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) => handlePhoneChange(e.target.value, 'mobile', formData, setFormData)}
                placeholder="(555) 555-1234"
                maxLength={14}
                className="mt-1"
              />
            </div>
          </div>

          {/* Address */}
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Address</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="addr1">Address Line 1</Label>
                <Input
                  id="addr1"
                  value={formData.addr1}
                  onChange={(e) => setFormData({ ...formData, addr1: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="addr2">Address Line 2</Label>
                <Input
                  id="addr2"
                  value={formData.addr2}
                  onChange={(e) => setFormData({ ...formData, addr2: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    maxLength={32}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="countryCode">Country</Label>
                  <select
                    id="countryCode"
                    value={formData.countryCode}
                    onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 shadow-sm dark:shadow-gray-900/50 focus:border-cyan-700 focus:outline-none focus:ring-1 focus:ring-cyan-700"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="GB">United Kingdom</option>
                    <option value="AU">Australia</option>
                    <option value="IN">India</option>
                    <option value="PH">Philippines</option>
                    <option value="SG">Singapore</option>
                    <option disabled>──────────</option>
                    <option value="AF">Afghanistan</option>
                    <option value="DZ">Algeria</option>
                    <option value="AO">Angola</option>
                    <option value="AR">Argentina</option>
                    <option value="BD">Bangladesh</option>
                    <option value="BR">Brazil</option>
                    <option value="BF">Burkina Faso</option>
                    <option value="CM">Cameroon</option>
                    <option value="CN">China</option>
                    <option value="CO">Colombia</option>
                    <option value="CD">Congo (DRC)</option>
                    <option value="CI">Côte d&apos;Ivoire</option>
                    <option value="EG">Egypt</option>
                    <option value="ET">Ethiopia</option>
                    <option value="FR">France</option>
                    <option value="DE">Germany</option>
                    <option value="GH">Ghana</option>
                    <option value="ID">Indonesia</option>
                    <option value="IR">Iran</option>
                    <option value="IQ">Iraq</option>
                    <option value="IT">Italy</option>
                    <option value="JP">Japan</option>
                    <option value="KE">Kenya</option>
                    <option value="KR">Korea (South)</option>
                    <option value="MG">Madagascar</option>
                    <option value="MY">Malaysia</option>
                    <option value="ML">Mali</option>
                    <option value="MX">Mexico</option>
                    <option value="MA">Morocco</option>
                    <option value="MZ">Mozambique</option>
                    <option value="MM">Myanmar</option>
                    <option value="NP">Nepal</option>
                    <option value="NE">Niger</option>
                    <option value="NG">Nigeria</option>
                    <option value="PK">Pakistan</option>
                    <option value="PE">Peru</option>
                    <option value="PL">Poland</option>
                    <option value="RO">Romania</option>
                    <option value="RU">Russia</option>
                    <option value="SA">Saudi Arabia</option>
                    <option value="SN">Senegal</option>
                    <option value="ZA">South Africa</option>
                    <option value="ES">Spain</option>
                    <option value="LK">Sri Lanka</option>
                    <option value="SD">Sudan</option>
                    <option value="SY">Syria</option>
                    <option value="TW">Taiwan</option>
                    <option value="TZ">Tanzania</option>
                    <option value="TH">Thailand</option>
                    <option value="TR">Turkey</option>
                    <option value="UG">Uganda</option>
                    <option value="UA">Ukraine</option>
                    <option value="UZ">Uzbekistan</option>
                    <option value="VE">Venezuela</option>
                    <option value="VN">Vietnam</option>
                    <option value="YE">Yemen</option>
                    <option disabled>──────────</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agency Features & Password */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card data-tour="profile-agency" className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Building2 className="h-5 w-5 text-amber-600" />
              Agency Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-900">Enable Agency Features</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Gives you the ability to add and manage team member permissions. This will also enable Client Pay, a feature that allows you to select services for your client, but allowing them to make online payment.
                </p>
              </div>
              <Switch
                checked={isAgency}
                onCheckedChange={setIsAgency}
              />
            </div>
          </CardContent>
        </Card>

        <div data-tour="profile-password">
          <PasswordSection hasPassword={hasPassword} />
        </div>
      </div>

      {/* Integrations */}
      <IntegrationsSection />

    </form>
  )
}

function IntegrationsSection() {
  const searchParams = useSearchParams()
  const [slackStatus, setSlackStatus] = useState<{ connected: boolean; channelName?: string; teamName?: string }>({ connected: false })
  const [gcalConnected, setGcalConnected] = useState(false)
  const [gchatStatus, setGchatStatus] = useState<{ connected: boolean; spaceName?: string }>({ connected: false })
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [gchatDialogOpen, setGchatDialogOpen] = useState(false)
  const [gchatWebhookUrl, setGchatWebhookUrl] = useState('')
  const [gchatSpaceName, setGchatSpaceName] = useState('')
  const [gchatSaving, setGchatSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/slack/status').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/google-calendar/status').then(r => r.json()).catch(() => ({ connected: false })),
      fetch('/api/google-chat/status').then(r => r.json()).catch(() => ({ connected: false })),
    ]).then(([slack, gcal, gchat]) => {
      setSlackStatus(slack)
      setGcalConnected(gcal.connected)
      setGchatStatus(gchat)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (searchParams.get('slack_connected') === 'true') {
      toast.success('Slack connected successfully')
      fetch('/api/slack/status').then(r => r.json()).then(setSlackStatus).catch(() => {})
    }
    if (searchParams.get('slack_error')) {
      toast.error(`Slack connection failed: ${searchParams.get('slack_error')}`)
    }
  }, [searchParams])

  const handleDisconnect = async (service: 'slack' | 'google-calendar' | 'google-chat') => {
    setDisconnecting(service)
    try {
      const resp = await fetch(`/api/${service}/disconnect`, { method: 'POST' })
      if (resp.ok) {
        if (service === 'slack') setSlackStatus({ connected: false })
        else if (service === 'google-calendar') setGcalConnected(false)
        else setGchatStatus({ connected: false })
        const label = service === 'slack' ? 'Slack' : service === 'google-calendar' ? 'Google Calendar' : 'Google Chat'
        toast.success(`${label} disconnected`)
      }
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  const handleGchatConnect = async () => {
    if (!gchatWebhookUrl.trim()) {
      toast.error('Webhook URL is required')
      return
    }
    setGchatSaving(true)
    try {
      const resp = await fetch('/api/google-chat/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: gchatWebhookUrl.trim(), spaceName: gchatSpaceName.trim() || undefined }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setGchatStatus({ connected: true, spaceName: gchatSpaceName.trim() || undefined })
        setGchatDialogOpen(false)
        setGchatWebhookUrl('')
        setGchatSpaceName('')
        toast.success('Google Chat connected! A test message was sent.')
      } else {
        toast.error(data.error || 'Failed to connect')
      }
    } catch {
      toast.error('Failed to connect')
    } finally {
      setGchatSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="h-5 w-5" />
          Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Slack */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-purple-700 dark:text-purple-400" fill="currentColor">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Slack</p>
              {loading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Checking...</p>
              ) : slackStatus.connected ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Connected to {slackStatus.teamName || 'workspace'} &middot; #{slackStatus.channelName || 'channel'}
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications in Slack</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Press release status updates, new messages, and task assignments
              </p>
            </div>
          </div>
          {!loading && (
            slackStatus.connected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect('slack')}
                disabled={disconnecting === 'slack'}
                className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-50"
              >
                {disconnecting === 'slack' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => { window.location.href = '/api/slack/connect' }}
                className="cursor-pointer bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                Connect
              </Button>
            )
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Google Calendar */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Google Calendar</p>
              {loading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Checking...</p>
              ) : gcalConnected ? (
                <p className="text-sm text-green-600 dark:text-green-400">Connected</p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Sync events to Google Calendar</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Content calendar events automatically sync to your Google Calendar
              </p>
            </div>
          </div>
          {!loading && (
            gcalConnected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect('google-calendar')}
                disabled={disconnecting === 'google-calendar'}
                className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-50"
              >
                {disconnecting === 'google-calendar' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => { window.location.href = '/api/google-calendar/connect' }}
                className="cursor-pointer bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                Connect
              </Button>
            )
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Google Chat */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">Google Chat</p>
              {loading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Checking...</p>
              ) : gchatStatus.connected ? (
                <p className="text-sm text-green-600 dark:text-green-400">
                  Connected{gchatStatus.spaceName ? ` to ${gchatStatus.spaceName}` : ''}
                </p>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Send notifications to Google Chat</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Press release status updates, new messages, and task assignments
              </p>
            </div>
          </div>
          {!loading && (
            gchatStatus.connected ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDisconnect('google-chat')}
                disabled={disconnecting === 'google-chat'}
                className="cursor-pointer text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-50"
              >
                {disconnecting === 'google-chat' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disconnect'}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => setGchatDialogOpen(true)}
                className="cursor-pointer bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                Connect
              </Button>
            )
          )}
        </div>
      </CardContent>

      {/* Google Chat Connect Dialog */}
      <Dialog open={gchatDialogOpen} onOpenChange={setGchatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Google Chat</DialogTitle>
            <DialogDescription>
              Paste the webhook URL from your Google Chat Space to receive notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <ol className="text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside space-y-1">
              <li>Open <strong>Google Chat</strong> and go to the Space where you want notifications</li>
              <li>Click the Space name at the top to open settings</li>
              <li>Go to <strong>Apps &amp; integrations</strong></li>
              <li>Click <strong>Webhooks</strong>, then <strong>Create a webhook</strong></li>
              <li>Name it (e.g. &ldquo;Newsworthy&rdquo;) and click <strong>Save</strong></li>
              <li>Copy the generated URL and paste it below</li>
            </ol>
            <div>
              <Label htmlFor="gchatWebhookUrl">Webhook URL</Label>
              <Input
                id="gchatWebhookUrl"
                value={gchatWebhookUrl}
                onChange={(e) => setGchatWebhookUrl(e.target.value)}
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="gchatSpaceName">Space Name (optional)</Label>
              <Input
                id="gchatSpaceName"
                value={gchatSpaceName}
                onChange={(e) => setGchatSpaceName(e.target.value)}
                placeholder="e.g. PR Notifications"
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setGchatDialogOpen(false)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleGchatConnect}
                disabled={gchatSaving}
                className="cursor-pointer bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
              >
                {gchatSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password')
      }

      setSuccess('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {hasPassword ? 'Change Password' : 'Set Password'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasPassword && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your account was created with Google or LinkedIn. Set a password to also sign in with email.
          </p>
        )}

        <div className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">{error}</div>
          )}
          {success && (
            <div className="p-3 text-sm text-green-700 dark:text-green-400 bg-green-50 rounded-lg">{success}</div>
          )}

          {hasPassword && (
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative mt-1">
                <Input
                  id="currentPassword"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 cursor-pointer"
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-400 cursor-pointer"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <Button
            type="button"
            onClick={handlePasswordSubmit}
            disabled={isLoading}
            className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              hasPassword ? 'Change Password' : 'Set Password'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
