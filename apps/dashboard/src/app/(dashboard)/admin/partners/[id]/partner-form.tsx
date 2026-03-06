'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { ImageUpload } from '@/components/upload/image-upload'
import { Building2, Loader2, Trash2 } from 'lucide-react'

interface PartnerFormProps {
  partner: {
    id: number
    company: string | null
    brandName: string | null
    handle: string | null
    logo: string | null
    publisherUrl: string | null
    partnerType: string | null
    isActive: boolean | null
    contactName: string | null
    contactEmail: string | null
    email: string | null
    phone: string | null
    addr1: string | null
    addr2: string | null
    csz: string | null
    basePrice: number | null
    freePrs: number | null
    feedLength: number | null
    backfill: string | null
    offerCopy: string | null
    appkey: string | null
    appsecret: string | null
    apptoken: string | null
    includeNewsdb: boolean | null
  }
}

export function PartnerForm({ partner }: PartnerFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [logoUrl, setLogoUrl] = useState(partner.logo || '')

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('logo', file)
      const res = await fetch(`/api/admin/partners/${partner.id}/logo`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to upload logo')
      }
      const data = await res.json()
      setLogoUrl(data.logoUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    setIsRemovingLogo(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}/logo`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove logo')
      }
      setLogoUrl('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove logo')
    } finally {
      setIsRemovingLogo(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this partner? This cannot be undone from the UI.')) {
      return
    }
    setIsDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete partner')
      }
      router.push('/admin/partners')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete partner')
      setIsDeleting(false)
    }
  }

  const [formData, setFormData] = useState({
    company: partner.company || '',
    brandName: partner.brandName || '',
    handle: partner.handle || '',
    publisherUrl: partner.publisherUrl || '',
    partnerType: partner.partnerType || '',
    isActive: partner.isActive ?? false,
    contactName: partner.contactName || '',
    contactEmail: partner.contactEmail || '',
    email: partner.email || '',
    phone: partner.phone || '',
    addr1: partner.addr1 || '',
    addr2: partner.addr2 || '',
    csz: partner.csz || '',
    basePrice: partner.basePrice !== null ? (partner.basePrice / 100).toFixed(2) : '',
    freePrs: partner.freePrs?.toString() || '0',
    feedLength: partner.feedLength?.toString() || '',
    backfill: partner.backfill || '',
    offerCopy: partner.offerCopy || '',
    appkey: partner.appkey || '',
    appsecret: partner.appsecret || '',
    apptoken: partner.apptoken || '',
    includeNewsdb: partner.includeNewsdb ?? true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/admin/partners/${partner.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update partner')
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Edit Partner</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6 text-sm">
          {error && (
            <div className="bg-red-50 text-red-600 dark:text-red-400 p-3 rounded text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 text-green-600 dark:text-green-400 p-3 rounded text-sm">
              Partner updated successfully.
            </div>
          )}

          {/* Basic Info */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Basic Info</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="brandName">Brand Name</Label>
                <Input
                  id="brandName"
                  value={formData.brandName}
                  onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="handle">Handle</Label>
                <Input
                  id="handle"
                  value={formData.handle}
                  onChange={(e) => setFormData({ ...formData, handle: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="partnerType">Partner Type</Label>
                <Select
                  id="partnerType"
                  value={formData.partnerType}
                  onChange={(e) => setFormData({ ...formData, partnerType: e.target.value })}
                  className="mt-1"
                >
                  <option value="">Select type</option>
                  <option value="affiliate">Affiliate</option>
                  <option value="agency">Agency</option>
                  <option value="publisher">Publisher</option>
                  <option value="reseller">Reseller</option>
                </Select>
              </div>
            </div>

            <div>
              <Label>Logo</Label>
              <div className="mt-1 flex items-start gap-4">
                <div className="flex-shrink-0 h-20 w-20 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Partner logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Building2 className="h-8 w-8 text-gray-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <ImageUpload
                    onFileSelect={(file) => handleLogoUpload(file)}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    maxSize={5 * 1024 * 1024}
                    buttonText={isUploadingLogo ? 'Uploading...' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                    buttonVariant="outline"
                    disabled={isUploadingLogo || isRemovingLogo}
                  />
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleLogoRemove}
                      disabled={isRemovingLogo || isUploadingLogo}
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400 hover:bg-red-50"
                    >
                      {isRemovingLogo ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="publisherUrl">Publisher URL</Label>
              <Input
                id="publisherUrl"
                value={formData.publisherUrl}
                onChange={(e) => setFormData({ ...formData, publisherUrl: e.target.value })}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, isActive: checked === true })
                }
              />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
          </fieldset>

          {/* Contact */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Contact</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Address</legend>

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
            <div>
              <Label htmlFor="csz">City, State, Zip</Label>
              <Input
                id="csz"
                value={formData.csz}
                onChange={(e) => setFormData({ ...formData, csz: e.target.value })}
                className="mt-1"
              />
            </div>
          </fieldset>

          {/* Pricing */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Pricing</legend>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="basePrice">Base Price ($)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter in dollars (stored as cents)</p>
              </div>
              <div>
                <Label htmlFor="freePrs">Free PRs</Label>
                <Input
                  id="freePrs"
                  type="number"
                  min="0"
                  value={formData.freePrs}
                  onChange={(e) => setFormData({ ...formData, freePrs: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="feedLength">Feed Length</Label>
                <Input
                  id="feedLength"
                  type="number"
                  min="0"
                  value={formData.feedLength}
                  onChange={(e) => setFormData({ ...formData, feedLength: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="backfill">Backfill</Label>
                <Input
                  id="backfill"
                  value={formData.backfill}
                  onChange={(e) => setFormData({ ...formData, backfill: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </fieldset>

          {/* Content */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Content</legend>

            <div>
              <Label htmlFor="offerCopy">Offer Copy</Label>
              <Textarea
                id="offerCopy"
                rows={4}
                value={formData.offerCopy}
                onChange={(e) => setFormData({ ...formData, offerCopy: e.target.value })}
                className="mt-1"
              />
            </div>
          </fieldset>

          {/* Integration */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Integration</legend>

            <div>
              <Label htmlFor="appkey">App Key</Label>
              <Input
                id="appkey"
                value={formData.appkey}
                onChange={(e) => setFormData({ ...formData, appkey: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="appsecret">App Secret</Label>
              <Input
                id="appsecret"
                value={formData.appsecret}
                onChange={(e) => setFormData({ ...formData, appsecret: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="apptoken">App Token</Label>
              <Input
                id="apptoken"
                value={formData.apptoken}
                onChange={(e) => setFormData({ ...formData, apptoken: e.target.value })}
                className="mt-1"
              />
            </div>
          </fieldset>

          {/* Options */}
          <fieldset className="border border-gray-200 dark:border-gray-800 p-4 rounded-lg space-y-3">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 px-2">Options</legend>

            <div className="flex items-center gap-2">
              <Checkbox
                id="includeNewsdb"
                checked={formData.includeNewsdb}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, includeNewsdb: checked === true })
                }
              />
              <Label htmlFor="includeNewsdb" className="cursor-pointer">Include NewsDB</Label>
            </div>
          </fieldset>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>

          <hr className="border-gray-200 dark:border-gray-800" />

          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-4">
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">Delete Partner</p>
              <p className="text-xs text-red-600 dark:text-red-400">This will soft-delete the partner. They will no longer appear in any views.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleDelete}
              disabled={isDeleting}
              className="border-red-300 text-red-600 dark:text-red-400 hover:bg-red-100 dark:bg-red-900/30 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
