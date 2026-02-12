'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Editor } from '@tinymce/tinymce-react'
import {
  Info,
  Loader2,
  Save,
  Globe,
  Share2,
  Cloud,
  Building2,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

interface NewsroomFormData {
  nrUri: string
  nrTitle: string
  nrDesc: string
  website: string
  linkedinUrl: string
  xUrl: string
  youtubeUrl: string
  instagramUrl: string
  blogUrl: string
  googleDriveUrl: string
  dropboxUrl: string
  boxUrl: string
  agencyName: string
  agencyWebsite: string
  agencyContactName: string
  agencyContactPhone: string
  agencyContactEmail: string
  gmb: string
}

interface NewsroomFormProps {
  companyUuid: string
  initialData: NewsroomFormData
}

export function NewsroomForm({ companyUuid, initialData }: NewsroomFormProps) {
  const router = useRouter()
  const editorRef = useRef<any>(null)
  const [formData, setFormData] = useState<NewsroomFormData>(initialData)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Slug validation
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const updateField = (field: keyof NewsroomFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSlugChange = (value: string) => {
    const cleaned = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32)
    updateField('nrUri', cleaned)
  }

  // Debounced slug uniqueness check
  useEffect(() => {
    if (!formData.nrUri || formData.nrUri.length < 3) {
      setSlugStatus('idle')
      return
    }

    // If slug hasn't changed from initial, it's fine
    if (formData.nrUri === initialData.nrUri) {
      setSlugStatus('available')
      return
    }

    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/company/${companyUuid}/newsroom?slug=${formData.nrUri}`)
        const data = await res.json()
        setSlugStatus(data.available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.nrUri, companyUuid, initialData.nrUri])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const nrDesc = editorRef.current?.getContent() || ''

      const response = await fetch(`/api/company/${companyUuid}/newsroom`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          nrDesc,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save newsroom settings')
      }

      setSuccess('Newsroom settings saved successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  const newsroomUrl = formData.nrUri
    ? `https://newsworthy.ai/newsroom/${formData.nrUri}`
    : null

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
            About Your Newsroom
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <p className="text-gray-700">
            Your newsroom is a public-facing page that showcases your press releases, company information, and media resources.
          </p>
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Newsroom features:</h4>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              <li>Branded public page for your press releases</li>
              <li>Social media and blog links for media contacts</li>
              <li>Cloud storage links for press kits and media assets</li>
              <li>Agency of record contact information</li>
            </ul>
          </div>
          {newsroomUrl && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800">Your Newsroom URL</p>
                <p className="text-sm text-blue-700 font-mono">{newsroomUrl}</p>
              </div>
              <a
                href={newsroomUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Newsroom Configuration */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Newsroom Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div>
            <Label htmlFor="nrUri" className="font-semibold">Newsroom Address *</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-500 whitespace-nowrap">newsworthy.ai/newsroom/</span>
              <Input
                id="nrUri"
                value={formData.nrUri}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="your-company"
                className="font-mono"
                maxLength={32}
              />
              <div className="shrink-0 w-5">
                {slugStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                )}
                {slugStatus === 'available' && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {slugStatus === 'taken' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">
                3–32 characters. Letters, numbers, and hyphens only.
              </p>
              <span className="text-xs text-gray-400">{formData.nrUri.length}/32</span>
            </div>
            {slugStatus === 'taken' && (
              <p className="text-xs text-red-600 mt-1">This newsroom address is already taken.</p>
            )}
          </div>

          <div>
            <Label htmlFor="nrTitle" className="font-semibold">Newsroom Title</Label>
            <Input
              id="nrTitle"
              value={formData.nrTitle}
              onChange={(e) => updateField('nrTitle', e.target.value)}
              placeholder="e.g. Acme Corp Newsroom"
              className="mt-1"
              maxLength={128}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-400">
                Displayed as the heading on your newsroom page.
              </p>
              <span className="text-xs text-gray-400">{formData.nrTitle.length}/128</span>
            </div>
          </div>

          <div>
            <Label className="font-semibold">Newsroom Description</Label>
            <p className="text-xs text-gray-400 mb-2">
              A brief description of your company or newsroom. Supports rich text formatting.
            </p>
            <Editor
              apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
              onInit={(_evt, editor) => (editorRef.current = editor)}
              initialValue={formData.nrDesc}
              init={{
                height: 400,
                menubar: false,
                plugins: ['lists', 'link'],
                toolbar: 'undo redo | blocks | bold italic | bullist numlist | link',
                content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
                branding: false,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Media Links */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Social Media Links
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            Add your social media profiles. These will be displayed on your newsroom page.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
              <Input
                id="linkedinUrl"
                type="url"
                value={formData.linkedinUrl}
                onChange={(e) => updateField('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/company/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="xUrl">X (Twitter) URL</Label>
              <Input
                id="xUrl"
                type="url"
                value={formData.xUrl}
                onChange={(e) => updateField('xUrl', e.target.value)}
                placeholder="https://x.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="youtubeUrl">YouTube URL</Label>
              <Input
                id="youtubeUrl"
                type="url"
                value={formData.youtubeUrl}
                onChange={(e) => updateField('youtubeUrl', e.target.value)}
                placeholder="https://youtube.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="instagramUrl">Instagram URL</Label>
              <Input
                id="instagramUrl"
                type="url"
                value={formData.instagramUrl}
                onChange={(e) => updateField('instagramUrl', e.target.value)}
                placeholder="https://instagram.com/..."
                className="mt-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="blogUrl">Blog URL</Label>
            <Input
              id="blogUrl"
              type="url"
              value={formData.blogUrl}
              onChange={(e) => updateField('blogUrl', e.target.value)}
              placeholder="https://yourblog.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="website">Website URL</Label>
            <Input
              id="website"
              type="url"
              value={formData.website}
              onChange={(e) => updateField('website', e.target.value)}
              placeholder="https://yourcompany.com"
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cloud Storage Links */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Cloud Storage Links
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            Link to public folders containing press kits, logos, and other media assets.
          </p>
          <div>
            <Label htmlFor="googleDriveUrl">Google Drive Public Folder URL</Label>
            <Input
              id="googleDriveUrl"
              type="url"
              value={formData.googleDriveUrl}
              onChange={(e) => updateField('googleDriveUrl', e.target.value)}
              placeholder="https://drive.google.com/..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="dropboxUrl">Dropbox Public Folder URL</Label>
            <Input
              id="dropboxUrl"
              type="url"
              value={formData.dropboxUrl}
              onChange={(e) => updateField('dropboxUrl', e.target.value)}
              placeholder="https://dropbox.com/..."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="boxUrl">Box Public Folder URL</Label>
            <Input
              id="boxUrl"
              type="url"
              value={formData.boxUrl}
              onChange={(e) => updateField('boxUrl', e.target.value)}
              placeholder="https://app.box.com/..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Google My Business Embed */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Google My Business
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            Embed your Google My Business location on your newsroom and press releases.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">How to get your embed code:</p>
            <ol className="list-decimal list-inside text-xs text-amber-700 space-y-0.5">
              <li>Go to <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Maps</a> and search for your business</li>
              <li>Click the <strong>Share</strong> button</li>
              <li>Select the <strong>Embed a map</strong> tab</li>
              <li>Copy the HTML code and paste it below</li>
            </ol>
          </div>
          <div>
            <Label htmlFor="gmb" className="font-semibold">Embed Code</Label>
            <Textarea
              id="gmb"
              value={formData.gmb}
              onChange={(e) => updateField('gmb', e.target.value)}
              rows={5}
              className="mt-1 font-mono text-xs"
              placeholder={'<iframe src="https://www.google.com/maps/embed?pb=..." width="600" height="450" ...></iframe>'}
            />
            <p className="text-xs text-gray-400 mt-1">
              Paste the full iframe embed code from Google Maps. Leave empty to disable.
            </p>
          </div>
          {formData.gmb && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Preview:</p>
              <div
                className="rounded-lg overflow-hidden border"
                dangerouslySetInnerHTML={{ __html: formData.gmb }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agency of Record */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Agency of Record
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            If you work with a PR or marketing agency, add their contact information here.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agencyName">Agency Name</Label>
              <Input
                id="agencyName"
                value={formData.agencyName}
                onChange={(e) => updateField('agencyName', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="agencyWebsite">Agency Website</Label>
              <Input
                id="agencyWebsite"
                type="url"
                value={formData.agencyWebsite}
                onChange={(e) => updateField('agencyWebsite', e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="agencyContactName">Contact Name</Label>
              <Input
                id="agencyContactName"
                value={formData.agencyContactName}
                onChange={(e) => updateField('agencyContactName', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="agencyContactPhone">Contact Phone</Label>
              <Input
                id="agencyContactPhone"
                value={formData.agencyContactPhone}
                onChange={(e) => updateField('agencyContactPhone', e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="agencyContactEmail">Contact Email</Label>
              <Input
                id="agencyContactEmail"
                type="email"
                value={formData.agencyContactEmail}
                onChange={(e) => updateField('agencyContactEmail', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving || slugStatus === 'taken' || formData.nrUri.length < 3}
          size="lg"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Newsroom Settings
        </Button>
      </div>
    </div>
  )
}
