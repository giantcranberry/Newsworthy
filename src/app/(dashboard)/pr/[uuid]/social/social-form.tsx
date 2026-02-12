'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageCropper } from '@/components/image-cropper'
import { WizardActions } from '@/components/pr-wizard/wizard-actions'
import { Share2, X, Check, Info, Upload, Loader2, Crop, Library } from 'lucide-react'

interface BannerRecord {
  id: number
  uuid: string
  url: string
  title?: string | null
  imgCredits?: string | null
  width?: number | null
  height?: number | null
}

interface SocialFormProps {
  releaseUuid: string
  banner: BannerRecord | null
  releaseTitle: string
  bannerLibrary: BannerRecord[]
}

function resizedUrl(url: string) {
  if (url.includes('RESIZE')) {
    return url.replace('RESIZE', 'resize=width:300')
  }
  return url
}

export function SocialForm({ releaseUuid, banner, releaseTitle, bannerLibrary }: SocialFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentBanner, setCurrentBanner] = useState<BannerRecord | null>(banner)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [formData, setFormData] = useState({
    title: banner?.title || releaseTitle || '',
    imgCredits: banner?.imgCredits || '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayBannerRaw = bannerPreview || currentBanner?.url
  const displayBanner = displayBannerRaw ? resizedUrl(displayBannerRaw) : null

  // Filter out the currently selected banner from the library
  const availableLibraryBanners = bannerLibrary.filter(
    (b) => !currentBanner || b.id !== currentBanner.id
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.')
      return
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPEG, or WebP.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string

      // Check if image is already 1200x630
      const img = new window.Image()
      img.onload = () => {
        if (img.width === 1200 && img.height === 630) {
          // Already correct size, use directly
          setBannerFile(file)
          setBannerPreview(dataUrl)
        } else {
          // Open cropper
          setCropperImageSrc(dataUrl)
          setShowCropper(true)
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)

    e.target.value = ''
  }

  const handleCropComplete = (croppedFile: File, croppedPreview: string) => {
    setBannerFile(croppedFile)
    setBannerPreview(croppedPreview)
  }

  const handleCropperClose = () => {
    setShowCropper(false)
    setCropperImageSrc(null)
  }

  const handleRecrop = () => {
    if (bannerPreview) {
      setCropperImageSrc(bannerPreview)
      setShowCropper(true)
    }
  }

  const handleRemoveBanner = () => {
    setBannerFile(null)
    setBannerPreview(null)
    setCropperImageSrc(null)
    setCurrentBanner(null)
  }

  const handleSelectFromLibrary = async (libraryBanner: BannerRecord) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/social`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bannerId: libraryBanner.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to select banner')
      }

      setCurrentBanner(libraryBanner)
      setBannerFile(null)
      setBannerPreview(null)
      setFormData({
        title: libraryBanner.title || releaseTitle || '',
        imgCredits: libraryBanner.imgCredits || '',
      })
      setShowLibrary(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select banner')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      if (bannerFile) {
        const fd = new FormData()
        fd.append('banner', bannerFile)
        if (formData.title) fd.append('title', formData.title)
        if (formData.imgCredits) fd.append('imgCredits', formData.imgCredits)

        const response = await fetch(`/api/pr/${releaseUuid}/social`, {
          method: 'POST',
          body: fd,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to save banner')
        }
      } else if (currentBanner && (
        formData.title !== currentBanner.title ||
        formData.imgCredits !== currentBanner.imgCredits
      )) {
        const response = await fetch(`/api/pr/${releaseUuid}/social`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formData.title || null,
            imgCredits: formData.imgCredits || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update banner')
        }
      }

      router.push(`/pr/${releaseUuid}/share`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {cropperImageSrc && (
        <ImageCropper
          imageSrc={cropperImageSrc}
          open={showCropper}
          onClose={handleCropperClose}
          onCropComplete={handleCropComplete}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Social Media Banner</CardTitle>
          <CardDescription>
            This image appears when your press release is shared on social media
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Size Info */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-blue-700">
              <strong>Recommended size: 1200 x 630 pixels</strong>
              <p className="text-blue-600 text-xs mt-1">
                This is the optimal size for Twitter, Facebook, and LinkedIn previews.
                Your image will be cropped to this aspect ratio.
              </p>
            </div>
          </div>

          {/* Banner Preview / Upload */}
          <div className="space-y-4">
            {displayBanner ? (
              <div className="relative w-full" style={{ aspectRatio: '1200/630' }}>
                <div className="absolute inset-0 border rounded-lg overflow-hidden bg-gray-50">
                  <Image
                    src={displayBanner}
                    alt="Social media banner"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {bannerPreview && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" />
                        New
                      </span>
                    </div>
                  )}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center bg-gray-50 text-gray-400"
                style={{ aspectRatio: '1200/630' }}
              >
                <Share2 className="h-12 w-12 mb-2" />
                <p className="text-sm">1200 x 630 pixels</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4" />
                {displayBanner ? 'Replace Banner' : 'Upload Banner'}
              </Button>
              {availableLibraryBanners.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowLibrary(!showLibrary)}
                  disabled={isLoading}
                >
                  <Library className="h-4 w-4" />
                  {showLibrary ? 'Hide Library' : 'Banner Library'}
                </Button>
              )}
              {bannerPreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRecrop}
                  disabled={isLoading}
                >
                  <Crop className="h-4 w-4" />
                  Re-crop
                </Button>
              )}
              {displayBanner && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBanner}
                  className="text-gray-500"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>

            {/* Banner Library Selector */}
            {showLibrary && availableLibraryBanners.length > 0 && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Select from your banner library</h4>
                <div className="grid grid-cols-3 gap-3">
                  {availableLibraryBanners.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleSelectFromLibrary(b)}
                      disabled={isLoading}
                      className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-400 transition-colors"
                      style={{ aspectRatio: '1200/630' }}
                    >
                      <Image
                        src={resizedUrl(b.url)}
                        alt={b.title || 'Banner image'}
                        fill
                        className="object-cover"
                      />
                      {b.title && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
                          <p className="text-xs text-white truncate">{b.title}</p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Banner Metadata */}
          {displayBanner && (
            <div className="space-y-4 pt-4 border-t">
              <div>
                <Label htmlFor="title">Alt Text / Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Describe the image for accessibility"
                  className="mt-1"
                  maxLength={255}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Used for screen readers and when the image cannot load
                </p>
              </div>

              <div>
                <Label htmlFor="credits">Image Credits (Optional)</Label>
                <Input
                  id="credits"
                  value={formData.imgCredits}
                  onChange={(e) => setFormData({ ...formData, imgCredits: e.target.value })}
                  placeholder="e.g., Photo by Jane Smith"
                  className="mt-1"
                  maxLength={128}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={4}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        canProceed={true}
        showSkip={!displayBanner}
      />
    </div>
  )
}
