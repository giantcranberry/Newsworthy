'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, FileText, User, Building2, ExternalLink, Pencil, BarChart3, ArrowUpCircle, LinkIcon, Trash2, ImageIcon, Upload, X } from 'lucide-react'
import { SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface LookupResult {
  release: {
    id: number
    uuid: string
    title: string | null
    status: string
    distribution: string | null
    createdAt: string | null
    releaseAt: string | null
    releasedAt: string | null
    slug: string | null
    elasticDoc: string | null
    isDeleted: boolean | null
    isArchived: boolean | null
  }
  user: {
    id: number
    email: string
    firstName: string | null
    lastName: string | null
    isAdmin: boolean | null
    isEditor: boolean | null
    isStaff: boolean | null
  } | null
  brand: {
    id: number
    uuid: string
    companyName: string
    logoUrl: string | null
  } | null
  reportUrl: string | null
  banner: {
    id: number
    url: string | null
    title: string | null
    imgCredits: string | null
  } | null
  images: {
    imageId: number
    url: string | null
    title: string | null
    imgCredits: string | null
  }[]
}

function displayImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  return url.replace('RESIZE/', '')
}

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function extractPrId(input: string): string {
  const trimmed = input.trim()
  const urlMatch = trimmed.match(/\/news\/\d{8}(\d+)/)
  if (urlMatch) return urlMatch[1]
  return trimmed
}

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400',
  review: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400',
  approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400',
  hold: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
  draft: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
  draftnxt: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
  start: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
}

const statusLabels: Record<string, string> = {
  sent: 'Published',
  review: 'In Review',
  approved: 'Approved',
  hold: 'On Hold',
  draft: 'Draft',
  draftnxt: 'Draft',
  start: 'Draft',
}

const distributionOptions = [
  { value: 'standard', label: 'Standard', color: 'bg-gray-500' },
  { value: 'enhanced', label: 'Enhanced', color: 'bg-blue-900' },
  { value: 'yahoo', label: 'Yahoo', color: 'bg-purple-700' },
]

export function PRLookup({ isAdmin = false }: { isAdmin?: boolean }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [upgradeTarget, setUpgradeTarget] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [upgradeSuccess, setUpgradeSuccess] = useState('')
  const [reportUrlInput, setReportUrlInput] = useState('')
  const [savingReportUrl, setSavingReportUrl] = useState(false)
  const [reportUrlMessage, setReportUrlMessage] = useState('')
  const [takingDown, setTakingDown] = useState(false)
  const [takedownConfirm, setTakedownConfirm] = useState(false)
  const [takedownMessage, setTakedownMessage] = useState('')
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [bannerBusy, setBannerBusy] = useState(false)
  const [bannerConfirmRemove, setBannerConfirmRemove] = useState(false)
  const [newImageFile, setNewImageFile] = useState<File | null>(null)
  const [newImageAlt, setNewImageAlt] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [removingImageId, setRemovingImageId] = useState<number | null>(null)
  const [mediaMessage, setMediaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const resolvedId = extractPrId(input)
    if (!resolvedId || !/^\d+$/.test(resolvedId)) {
      setError('Could not extract a valid PR ID from the input.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setUpgradeTarget('')
    setUpgradeSuccess('')
    setReportUrlInput('')
    setReportUrlMessage('')
    setTakedownConfirm(false)
    setTakedownMessage('')
    setBannerConfirmRemove(false)
    setNewImageFile(null)
    setNewImageAlt('')
    setMediaMessage(null)

    try {
      const res = await fetch(`/api/admin/lookup?prId=${resolvedId}`)
      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Not found')
      }
    } catch {
      setError('Failed to look up press release')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async () => {
    if (!result || !upgradeTarget) return

    setUpgrading(true)
    setUpgradeSuccess('')

    try {
      const res = await fetch('/api/admin/lookup/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: result.release.id,
          distribution: upgradeTarget,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          ...result,
          release: { ...result.release, distribution: data.distribution },
        })
        setUpgradeSuccess(`Distribution updated to ${data.distribution}`)
        setUpgradeTarget('')
      } else {
        setError(data.error || 'Failed to upgrade')
      }
    } catch {
      setError('Failed to upgrade distribution')
    } finally {
      setUpgrading(false)
    }
  }

  const handleSaveReportUrl = async () => {
    if (!result || !reportUrlInput.trim()) return

    setSavingReportUrl(true)
    setReportUrlMessage('')

    try {
      const res = await fetch('/api/editorial/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: result.release.id,
          reportUrl: reportUrlInput.trim(),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({ ...result, reportUrl: reportUrlInput.trim() })
        setReportUrlMessage('Report URL saved')
        setReportUrlInput('')
      } else {
        setReportUrlMessage(data.error || 'Failed to save URL')
      }
    } catch {
      setReportUrlMessage('Failed to save URL')
    } finally {
      setSavingReportUrl(false)
    }
  }

  const handleTakedown = async () => {
    if (!result) return

    setTakingDown(true)
    setTakedownMessage('')

    try {
      const res = await fetch('/api/admin/lookup/takedown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ releaseId: result.release.id }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({
          ...result,
          release: { ...result.release, isDeleted: true, isArchived: true },
        })
        setTakedownMessage(
          data.esDeleted
            ? 'Release taken down and removed from search index'
            : 'Release taken down' + (result.release.elasticDoc ? ' (ES document was already removed)' : '')
        )
        setTakedownConfirm(false)
      } else {
        setTakedownMessage(data.error || 'Failed to take down release')
      }
    } catch {
      setTakedownMessage('Failed to take down release')
    } finally {
      setTakingDown(false)
    }
  }

  const handleBannerFile = async (file: File | undefined) => {
    if (!result || !file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setMediaMessage({ type: 'error', text: 'Invalid file type. Please upload PNG, JPEG, or WebP.' })
      return
    }

    setBannerBusy(true)
    setMediaMessage(null)

    try {
      const formData = new FormData()
      formData.append('banner', file)
      formData.append('title', result.banner?.title || result.release.title || '')
      if (result.banner?.imgCredits) formData.append('imgCredits', result.banner.imgCredits)

      const res = await fetch(`/api/pr/${result.release.uuid}/social`, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        setResult({
          ...result,
          banner: {
            id: data.banner.id,
            url: data.banner.url,
            title: data.banner.title,
            imgCredits: data.banner.imgCredits,
          },
        })
        setMediaMessage({ type: 'success', text: result.banner ? 'Social banner replaced' : 'Social banner added' })
      } else {
        setMediaMessage({ type: 'error', text: data.error || 'Failed to upload banner' })
      }
    } catch {
      setMediaMessage({ type: 'error', text: 'Failed to upload banner' })
    } finally {
      setBannerBusy(false)
      if (bannerInputRef.current) bannerInputRef.current.value = ''
    }
  }

  const handleRemoveBanner = async () => {
    if (!result) return

    setBannerBusy(true)
    setMediaMessage(null)

    try {
      const res = await fetch(`/api/pr/${result.release.uuid}/social`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        setResult({ ...result, banner: null })
        setMediaMessage({ type: 'success', text: 'Social banner removed' })
        setBannerConfirmRemove(false)
      } else {
        setMediaMessage({ type: 'error', text: data.error || 'Failed to remove banner' })
      }
    } catch {
      setMediaMessage({ type: 'error', text: 'Failed to remove banner' })
    } finally {
      setBannerBusy(false)
    }
  }

  const handleAddImage = async () => {
    if (!result || !newImageFile || !newImageAlt.trim()) return
    if (!ACCEPTED_IMAGE_TYPES.includes(newImageFile.type)) {
      setMediaMessage({ type: 'error', text: 'Invalid file type. Please upload PNG, JPEG, or WebP.' })
      return
    }

    setImageBusy(true)
    setMediaMessage(null)

    try {
      const formData = new FormData()
      formData.append('image', newImageFile)
      formData.append('title', newImageAlt.trim())

      const res = await fetch(`/api/pr/${result.release.uuid}/image`, { method: 'POST', body: formData })
      const data = await res.json()

      if (res.ok) {
        const img = data.releaseImage.image
        setResult({
          ...result,
          images: [
            ...result.images,
            { imageId: data.releaseImage.imageId, url: img?.url ?? null, title: img?.title ?? null, imgCredits: img?.imgCredits ?? null },
          ],
        })
        setNewImageFile(null)
        setNewImageAlt('')
        if (imageInputRef.current) imageInputRef.current.value = ''
        setMediaMessage({ type: 'success', text: 'Image added' })
      } else {
        setMediaMessage({ type: 'error', text: data.error || 'Failed to add image' })
      }
    } catch {
      setMediaMessage({ type: 'error', text: 'Failed to add image' })
    } finally {
      setImageBusy(false)
    }
  }

  const handleRemoveImage = async (imageId: number) => {
    if (!result) return

    setRemovingImageId(imageId)
    setMediaMessage(null)

    try {
      const res = await fetch(`/api/pr/${result.release.uuid}/image?imageId=${imageId}`, { method: 'DELETE' })
      const data = await res.json()

      if (res.ok) {
        setResult({ ...result, images: result.images.filter((i) => i.imageId !== imageId) })
        setMediaMessage({ type: 'success', text: 'Image removed' })
      } else {
        setMediaMessage({ type: 'error', text: data.error || 'Failed to remove image' })
      }
    } catch {
      setMediaMessage({ type: 'error', text: 'Failed to remove image' })
    } finally {
      setRemovingImageId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-gray-400" />
          PR Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleLookup} className="flex items-end gap-3">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Paste a newsworthy.ai URL or enter a PR ID..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            disabled={loading || !input.trim()}
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </Button>
        </form>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {result && (
          <div className="space-y-3 pt-2">
            {/* Release Info */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-green-700 dark:text-green-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.release.title || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">ID: {result.release.id}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[result.release.status] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200'}`}>
                        {statusLabels[result.release.status] || result.release.status}
                      </span>
                      {result.release.distribution && (
                        <span className="inline-flex items-center rounded-full bg-cyan-50 dark:bg-cyan-900/30 px-2 py-0.5 text-xs font-medium text-cyan-700">
                          {result.release.distribution}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {result.release.createdAt && (
                        <span>Created: {new Date(result.release.createdAt).toLocaleDateString()}</span>
                      )}
                      {result.release.releasedAt && (
                        <span>Released: {new Date(result.release.releasedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link href={`/editorial/edit/${result.release.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  </Link>
                  {result.release.status === 'sent' && result.release.releasedAt &&
                    Date.now() - new Date(result.release.releasedAt).getTime() > 24 * 60 * 60 * 1000 && (
                    <Link href={`/pr/clips/${result.release.uuid}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <BarChart3 className="h-3 w-3" />
                        View Report
                      </Button>
                    </Link>
                  )}
                  {result.release.status === 'sent' && result.release.releaseAt && result.release.slug && (
                    <a
                      href={`https://www.newsworthy.ai/news/${new Date(result.release.releaseAt).getFullYear()}${String(new Date(result.release.releaseAt).getMonth() + 1).padStart(2, '0')}${String(new Date(result.release.releaseAt).getDate()).padStart(2, '0')}${result.release.id}/${result.release.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <ExternalLink className="h-3 w-3" />
                        View Live
                      </Button>
                    </a>
                  )}
                  {result.release.status === 'sent' && (
                    <Link href={`/pr/clips/${result.release.uuid}`}>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <BarChart3 className="h-3 w-3" />
                        Clipping Report
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* User Info */}
            {result.user && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {result.user.firstName || result.user.lastName
                          ? [result.user.firstName, result.user.lastName].filter(Boolean).join(' ')
                          : result.user.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {result.user.firstName || result.user.lastName ? result.user.email : `User ID: ${result.user.id}`}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {result.user.isAdmin && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-[10px] font-medium">Admin</span>}
                        {result.user.isEditor && <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[10px] font-medium">Editor</span>}
                        {result.user.isStaff && <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-[10px] font-medium">Staff</span>}
                      </div>
                    </div>
                  </div>
                  <Link href={`/admin/users/${result.user.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <User className="h-3 w-3" />
                      View User
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Brand Info */}
            {result.brand && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {result.brand.logoUrl ? (
                      <img
                        src={result.brand.logoUrl.includes('RESIZE') ? result.brand.logoUrl.replace('RESIZE', 'resize=width:200/output=format:png') : result.brand.logoUrl}
                        alt={result.brand.companyName}
                        className="h-9 w-9 rounded-lg object-contain bg-gray-50 dark:bg-gray-950 flex-shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{result.brand.companyName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Brand ID: {result.brand.id}</p>
                    </div>
                  </div>
                  <Link href={`/admin/brands/${result.brand.uuid}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Building2 className="h-3 w-3" />
                      View Brand
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Distribution Upgrade - Admin Only */}
            {isAdmin && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ArrowUpCircle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900">Change Distribution</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Current: <span className="font-medium">{result.release.distribution || 'none'}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <SelectRoot value={upgradeTarget} onValueChange={setUpgradeTarget}>
                        <SelectTrigger className="w-48 h-8 text-xs bg-white dark:bg-gray-900">
                          <SelectValue placeholder="Select distribution" />
                        </SelectTrigger>
                        <SelectContent>
                          {distributionOptions
                            .filter(opt => opt.value !== result.release.distribution)
                            .map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                  <span className={`inline-block h-2 w-2 rounded-full ${opt.color}`} />
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </SelectRoot>
                      <Button
                        size="sm"
                        className="h-8 bg-amber-700 text-white hover:bg-amber-800 text-xs"
                        disabled={!upgradeTarget || upgrading}
                        onClick={handleUpgrade}
                      >
                        {upgrading ? 'Updating...' : 'Update'}
                      </Button>
                    </div>
                    {upgradeSuccess && (
                      <p className="text-xs text-green-700 dark:text-green-400 mt-2 font-medium">{upgradeSuccess}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Images & Social Banner - Admin Only */}
            {isAdmin && (
              <div className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ImageIcon className="h-4 w-4 text-violet-700 dark:text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <p className="text-sm font-medium text-violet-900 dark:text-violet-200">Images &amp; Social Banner</p>

                    {/* Social Banner */}
                    <div>
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-300 mb-1.5">Social Banner</p>
                      <div className="flex items-start gap-3">
                        {result.banner?.url ? (
                          <a href={displayImageUrl(result.banner.url)} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                            <img
                              src={displayImageUrl(result.banner.url)}
                              alt={result.banner.title || 'Social banner'}
                              className="h-20 w-[152px] rounded-md object-cover border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900"
                            />
                          </a>
                        ) : (
                          <div className="h-20 w-[152px] rounded-md border border-dashed border-violet-300 dark:border-violet-800 flex items-center justify-center text-xs text-violet-600 dark:text-violet-400 flex-shrink-0">
                            No banner
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          <input
                            ref={bannerInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => handleBannerFile(e.target.files?.[0])}
                          />
                          <Button
                            size="sm"
                            className="h-8 bg-violet-700 text-white hover:bg-violet-800 text-xs gap-1.5"
                            disabled={bannerBusy}
                            onClick={() => bannerInputRef.current?.click()}
                          >
                            <Upload className="h-3 w-3" />
                            {bannerBusy ? 'Working...' : result.banner ? 'Replace Banner' : 'Upload Banner'}
                          </Button>
                          {result.banner && (
                            !bannerConfirmRemove ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                disabled={bannerBusy}
                                onClick={() => setBannerConfirmRemove(true)}
                              >
                                Remove Banner
                              </Button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 bg-red-700 text-white hover:bg-red-800 text-xs"
                                  disabled={bannerBusy}
                                  onClick={handleRemoveBanner}
                                >
                                  Confirm remove
                                </Button>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setBannerConfirmRemove(false)}>
                                  Cancel
                                </Button>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80 mt-1.5">Recommended 1200×630. Uploaded as-is (no cropping).</p>
                    </div>

                    {/* News Images */}
                    <div>
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-300 mb-1.5">
                        News Images ({result.images.length})
                      </p>
                      {result.images.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {result.images.map((img, idx) => (
                            <div key={img.imageId} className="relative group">
                              <a href={displayImageUrl(img.url)} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={displayImageUrl(img.url)}
                                  alt={img.title || 'Release image'}
                                  title={img.title || undefined}
                                  className="h-20 w-20 rounded-md object-cover border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900"
                                />
                              </a>
                              {idx === 0 && (
                                <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] font-medium text-white">Primary</span>
                              )}
                              <button
                                type="button"
                                aria-label="Remove image"
                                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700 disabled:opacity-50"
                                disabled={removingImageId === img.imageId}
                                onClick={() => {
                                  if (window.confirm('Remove this image from the release?')) handleRemoveImage(img.imageId)
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-violet-700 dark:text-violet-400">No images attached</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-violet-100 dark:file:bg-violet-900/40 file:px-2 file:py-1 file:text-xs file:text-violet-800 dark:file:text-violet-200 max-w-[220px]"
                          onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                        />
                        <Input
                          type="text"
                          placeholder="Alt description (required)"
                          value={newImageAlt}
                          onChange={(e) => setNewImageAlt(e.target.value)}
                          className="flex-1 min-w-[180px] h-8 text-xs bg-white dark:bg-gray-900"
                        />
                        <Button
                          size="sm"
                          className="h-8 bg-violet-700 text-white hover:bg-violet-800 text-xs gap-1.5"
                          disabled={imageBusy || !newImageFile || !newImageAlt.trim()}
                          onClick={handleAddImage}
                        >
                          <Upload className="h-3 w-3" />
                          {imageBusy ? 'Uploading...' : 'Add Image'}
                        </Button>
                      </div>
                    </div>

                    {mediaMessage && (
                      <p className={`text-xs font-medium ${mediaMessage.type === 'success' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {mediaMessage.text}
                      </p>
                    )}
                    {result.release.status === 'sent' && (
                      <p className="text-[11px] text-violet-700/80 dark:text-violet-400/80">
                        Live page is cached for up to 4 hours, so changes may not appear on newsworthy.ai immediately.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Report URL - shown for enhanced/yahoo distributions */}
            {isAdmin && ['enhanced', 'yahoo'].includes(result.release.distribution || '') && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <LinkIcon className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-900">Report URL</p>
                    {result.reportUrl ? (
                      <div className="mt-1">
                        <a
                          href={result.reportUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-700 dark:text-blue-400 underline break-all"
                        >
                          {result.reportUrl}
                        </a>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 mb-1">Replace with a new URL:</p>
                      </div>
                    ) : (
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5 mb-1">No report URL set</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        type="url"
                        placeholder="Enter report URL"
                        value={reportUrlInput}
                        onChange={(e) => setReportUrlInput(e.target.value)}
                        className="flex-1 h-8 text-xs bg-white dark:bg-gray-900"
                      />
                      <Button
                        size="sm"
                        className="h-8 bg-blue-700 text-white hover:bg-blue-800 text-xs"
                        disabled={savingReportUrl || !reportUrlInput.trim()}
                        onClick={handleSaveReportUrl}
                      >
                        {savingReportUrl ? 'Saving...' : result.reportUrl ? 'Replace' : 'Save'}
                      </Button>
                    </div>
                    {reportUrlMessage && (
                      <p className={`text-xs mt-2 font-medium ${reportUrlMessage.includes('saved') ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {reportUrlMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Takedown - Admin Only */}
            {isAdmin && !result.release.isDeleted && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-red-900">Takedown Release</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      This will mark the release as deleted and archived, and remove it from the search index.
                    </p>
                    {!takedownConfirm ? (
                      <Button
                        size="sm"
                        className="mt-2 h-8 bg-red-700 text-white hover:bg-red-800 text-xs"
                        onClick={() => setTakedownConfirm(true)}
                      >
                        Takedown
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-red-800 font-medium">Are you sure?</p>
                        <Button
                          size="sm"
                          className="h-8 bg-red-700 text-white hover:bg-red-800 text-xs"
                          disabled={takingDown}
                          onClick={handleTakedown}
                        >
                          {takingDown ? 'Taking down...' : 'Yes, take it down'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => setTakedownConfirm(false)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    {takedownMessage && (
                      <p className={`text-xs mt-2 font-medium ${takedownMessage.includes('taken down') ? 'text-green-700' : 'text-red-700'}`}>
                        {takedownMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Already taken down indicator */}
            {result.release.isDeleted && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </div>
                  <p className="text-sm font-medium text-red-900">This release has been taken down</p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
