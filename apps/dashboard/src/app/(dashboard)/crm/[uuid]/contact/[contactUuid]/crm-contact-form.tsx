'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Save, ArrowLeft, User, Globe, Share2, FileText, BarChart3, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

interface ContactData {
  uuid: string
  contactType: string
  firstName: string
  lastName: string
  email: string
  phone: string
  notes: string
  tld: string
  publication: string
  qurl: string
  linkedin: string
  twitter: string
  facebook: string
  instagram: string
  crunchbase: string
  youtube: string
  md5: string
  emailCount: number
  unsubscribeAt: string | null
  lastOpenAt: string | null
  bouncedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

interface EnrichmentData {
  enrichedAt?: string
  apollo?: {
    person?: {
      title?: string
      headline?: string
      city?: string
      state?: string
      country?: string
      seniority?: string
      organization?: {
        name?: string
        industry?: string
        estimated_num_employees?: number
      }
    }
  }
}

interface CrmContactFormProps {
  companyUuid: string
  companyName: string
  readOnly: boolean
  contact: ContactData
  enrichment: EnrichmentData | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function StatusBadge({ contact }: { contact: ContactData }) {
  if (contact.bouncedAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        Bounced
      </span>
    )
  }
  if (contact.unsubscribeAt) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        Unsubscribed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
      Active
    </span>
  )
}

export function CrmContactForm({ companyUuid, companyName, readOnly, contact, enrichment }: CrmContactFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [formData, setFormData] = useState({
    contactType: contact.contactType,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    notes: contact.notes,
    tld: contact.tld,
    publication: contact.publication,
    qurl: contact.qurl,
    linkedin: contact.linkedin,
    twitter: contact.twitter,
    facebook: contact.facebook,
    instagram: contact.instagram,
    crunchbase: contact.crunchbase,
    youtube: contact.youtube,
    unsubscribed: !!contact.unsubscribeAt,
  })

  const update = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const gravatarUrl = `https://www.gravatar.com/avatar/${contact.md5}?d=mp&s=80`
  const displayName = [formData.firstName, formData.lastName].filter(Boolean).join(' ') || 'Unnamed Contact'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (readOnly) return
    setIsLoading(true)

    try {
      const res = await fetch(`/api/company/${companyUuid}/crm`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactUuid: contact.uuid,
          ...formData,
        }),
      })

      if (res.ok) {
        toast.success('Contact saved')
        router.push(`/crm/${companyUuid}`)
        router.refresh()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save contact')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEnrich = async () => {
    setIsEnriching(true)
    try {
      const res = await fetch(`/api/company/${companyUuid}/crm/enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactUuid: contact.uuid }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Enrichment failed')
        return
      }

      if (!data.matched) {
        toast.info('No matching record found in Apollo')
        return
      }

      // Update form state with enriched values
      if (data.fieldValues && typeof data.fieldValues === 'object') {
        setFormData(prev => ({ ...prev, ...data.fieldValues }))
      }

      const parts: string[] = []
      if (data.updated?.length > 0) {
        parts.push(`Updated: ${data.updated.join(', ')}`)
      }
      if (data.title) parts.push(`Title: ${data.title}`)
      if (data.company) parts.push(`Company: ${data.company}`)
      if (data.phoneAsync) parts.push('Phone number will arrive shortly')

      toast.success(parts.length > 0 ? parts.join(' | ') : data.message)
      router.refresh()
    } catch {
      toast.error('Enrichment request failed')
    } finally {
      setIsEnriching(false)
    }
  }

  const apolloPerson = enrichment?.apollo?.person

  return (
    <form onSubmit={handleSubmit} className="-mt-6 space-y-8 pb-16">
      {/* Sticky Action Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 -mx-6 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={gravatarUrl}
              alt=""
              className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">{displayName}</h1>
                <StatusBadge contact={contact} />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <Link href={`/crm/${companyUuid}`} className="hover:text-cyan-700 dark:hover:text-cyan-400">
                  <ArrowLeft className="h-3.5 w-3.5 inline mr-1" />
                  {companyName}
                </Link>
                <span>&middot;</span>
                <span>{contact.email}</span>
              </div>
            </div>
          </div>
          {!readOnly && (
            <div className="flex items-center gap-2 flex-shrink-0">
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
          )}
        </div>
      </div>

      <fieldset disabled={readOnly}>
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="contactType">Contact Type</Label>
              <Select
                id="contactType"
                value={formData.contactType}
                onChange={(e) => update('contactType', e.target.value)}
                className="mt-1"
              >
                <option value="">Unassigned</option>
                <option value="advocate">Share List Member</option>
                <option value="client">Client</option>
                <option value="influencer">Influencer</option>
                <option value="media">Media Pitch List</option>
                <option value="partner">Partner</option>
                <option value="prospect">Prospect</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => update('email', e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Media / Publication */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Publication
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="publication">Publication Name</Label>
                <Input
                  id="publication"
                  value={formData.publication}
                  onChange={(e) => update('publication', e.target.value)}
                  placeholder="e.g. TechCrunch"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="tld">Publication Domain</Label>
                <Input
                  id="tld"
                  value={formData.tld}
                  onChange={(e) => update('tld', e.target.value)}
                  placeholder="e.g. techcrunch.com"
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="qurl">URL</Label>
              <Input
                id="qurl"
                value={formData.qurl}
                onChange={(e) => update('qurl', e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Social Profiles */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Social Profiles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={formData.linkedin}
                  onChange={(e) => update('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="twitter">Twitter / X</Label>
                <Input
                  id="twitter"
                  value={formData.twitter}
                  onChange={(e) => update('twitter', e.target.value)}
                  placeholder="https://x.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={formData.facebook}
                  onChange={(e) => update('facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => update('instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="crunchbase">Crunchbase</Label>
                <Input
                  id="crunchbase"
                  value={formData.crunchbase}
                  onChange={(e) => update('crunchbase', e.target.value)}
                  placeholder="https://crunchbase.com/..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="youtube">YouTube</Label>
                <Input
                  id="youtube"
                  value={formData.youtube}
                  onChange={(e) => update('youtube', e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="notes">Internal Notes</Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => update('notes', e.target.value)}
                rows={5}
                className="mt-1 flex w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-700 dark:focus-visible:ring-cyan-500 focus-visible:border-cyan-700 dark:focus-visible:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="unsubscribed"
                checked={formData.unsubscribed}
                onChange={(e) => update('unsubscribed', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-cyan-700 focus:ring-cyan-700"
              />
              <Label htmlFor="unsubscribed" className="text-sm font-normal">
                Mark as unsubscribed
              </Label>
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {/* Apollo Enrichment Data */}
      {apolloPerson && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Enrichment Data
              {enrichment?.enrichedAt && (
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-auto">
                  Last enriched {formatDate(enrichment.enrichedAt)}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
              {apolloPerson.title && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Title</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{apolloPerson.title}</p>
                </div>
              )}
              {apolloPerson.headline && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Headline</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{apolloPerson.headline}</p>
                </div>
              )}
              {apolloPerson.seniority && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Seniority</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 capitalize">{apolloPerson.seniority}</p>
                </div>
              )}
              {apolloPerson.organization?.industry && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Industry</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{apolloPerson.organization.industry}</p>
                </div>
              )}
              {apolloPerson.organization?.estimated_num_employees && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Company Size</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{apolloPerson.organization.estimated_num_employees.toLocaleString()} employees</p>
                </div>
              )}
              {(apolloPerson.city || apolloPerson.state || apolloPerson.country) && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Location</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                    {[apolloPerson.city, apolloPerson.state, apolloPerson.country].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement & Metadata (always read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</p>
              <div className="mt-1"><StatusBadge contact={contact} /></div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Emails Sent</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{contact.emailCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Open</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(contact.lastOpenAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Bounced</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(contact.bouncedAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Added</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(contact.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Last Updated</p>
              <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(contact.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
