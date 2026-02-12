'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WizardActions } from '@/components/pr-wizard/wizard-actions'
import { Building2, Check, X, Upload, Loader2, AlertTriangle } from 'lucide-react'

interface LogoFormProps {
  releaseUuid: string
  currentLogoUrl: string | null
  companyName: string
}

export function LogoForm({ releaseUuid, currentLogoUrl, companyName }: LogoFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  const displayUrl = pendingPreview || logoUrl

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPEG, WebP, or SVG.')
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setPendingPreview(reader.result as string)
      setPendingFile(file)
      setImageError(false)
    }
    reader.readAsDataURL(file)

    // Reset input
    e.target.value = ''
  }

  const handleRemovePending = () => {
    setPendingFile(null)
    setPendingPreview(null)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleSubmit = async () => {
    // If no pending file, just proceed to next step (use existing logo)
    if (!pendingFile) {
      router.push(`/pr/${releaseUuid}/image`)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('logo', pendingFile)

      const response = await fetch(`/api/pr/${releaseUuid}/logo`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setLogoUrl(data.logoUrl)
      setPendingFile(null)
      setPendingPreview(null)
      router.push(`/pr/${releaseUuid}/image`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsUploading(false)
    }
  }

  const hasLogo = !!(displayUrl && !imageError)

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Logo</CardTitle>
          <CardDescription>
            This logo appears on your press releases and brand profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-amber-800">
              <strong>Note:</strong> Changing this logo will update it across all press releases for {companyName}.
            </div>
          </div>

          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {displayUrl && !imageError ? (
                <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-gray-50">
                  <Image
                    src={displayUrl}
                    alt={`${companyName} logo`}
                    fill
                    className="object-contain p-2"
                    unoptimized
                    onError={() => setImageError(true)}
                  />
                  {pendingPreview && (
                    <div className="absolute top-1 right-1">
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                        <Check className="h-3 w-3" />
                        New
                      </span>
                    </div>
                  )}
                  {!pendingPreview && logoUrl && (
                    <div className="absolute top-1 right-1">
                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    </div>
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50">
                  <Building2 className="h-12 w-12 text-gray-300" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-medium text-gray-900">{companyName}</h3>
                <p className="text-sm text-gray-500">
                  {logoUrl ? 'Logo uploaded' : 'No logo uploaded yet'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4" />
                  {displayUrl ? 'Replace Logo' : 'Upload Logo'}
                </Button>
                {pendingPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePending}
                    className="text-gray-500"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Recommended: Square image, at least 200x200px. PNG or SVG preferred for transparency.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={2}
        isLoading={isUploading}
        onSubmit={handleSubmit}
        canProceed={hasLogo}
        submitLabel={logoUrl && !pendingFile ? 'Continue' : undefined}
      />

      {!hasLogo && (
        <p className="text-sm text-amber-600 text-center">
          Please upload a logo to continue
        </p>
      )}
    </div>
  )
}
