'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import { Check, X, Upload, Loader2, AlertTriangle } from 'lucide-react'

interface LogoFormProps {
  releaseUuid: string
  currentLogoUrl: string | null
  companyName: string
  children?: React.ReactNode
}

export function LogoForm({ releaseUuid, currentLogoUrl, companyName, children }: LogoFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const displayUrl = pendingPreview || logoUrl

  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

  const processFile = useCallback((file: File) => {
    setError(null)

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload PNG, JPEG, WebP, or SVG.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPendingPreview(reader.result as string)
      setPendingFile(file)
      setImageError(false)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file)
    e.target.value = ''
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handleRemovePending = () => {
    setPendingFile(null)
    setPendingPreview(null)
  }

  const handleSubmit = async () => {
    if (!pendingFile) {
      router.push(`/pr/${releaseUuid}/faq`)
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
      router.push(`/pr/${releaseUuid}/faq`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsUploading(false)
    }
  }

  const hasLogo = !!(displayUrl && !imageError)

  return (
    <div className="space-y-6">
      <WizardHeader
        title="Brand Logo"
        description={`Logo for ${companyName}`}
        releaseUuid={releaseUuid}
        currentStep={2}
        isLoading={isUploading}
        onSubmit={handleSubmit}
        canProceed={hasLogo}
        submitLabel={logoUrl && !pendingFile ? 'Continue' : undefined}
      />
      {children}
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
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-amber-800 dark:text-amber-400">
              <strong>Note:</strong> Changing this logo will update it across all press releases for {companyName}.
            </div>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors ${
              isDragOver
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30'
                : displayUrl && !imageError
                  ? 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 hover:border-gray-300 dark:border-gray-700'
                  : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-400 hover:bg-cyan-50 dark:bg-cyan-900/30/50'
            }`}
          >
            {displayUrl && !imageError ? (
              <div className="flex flex-col items-center gap-4">
                {!pendingPreview && logoUrl && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  </div>
                )}
                {pendingPreview && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                      <Check className="h-3 w-3" />
                      New
                    </span>
                  </div>
                )}
                <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-white dark:bg-gray-900 border dark:border-gray-700">
                  <Image
                    src={displayUrl}
                    alt={`${companyName} logo`}
                    fill
                    className="object-contain p-2"
                    unoptimized
                    onError={() => setImageError(true)}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900/80">
                      <Loader2 className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drop a new image here or <span className="text-cyan-700 font-medium">click to replace</span>
                  </p>
                </div>
                {pendingPreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePending()
                    }}
                    className="text-gray-500 dark:text-gray-400"
                    disabled={isUploading}
                  >
                    <X className="h-4 w-4" />
                    Undo
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Drop your logo here, or <span className="text-cyan-700">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PNG, JPEG, WebP, or SVG up to 5MB
                  </p>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            Recommended: Square image, at least 200x200px. PNG or SVG preferred for transparency.
          </p>
        </CardContent>
      </Card>

      {!hasLogo && (
        <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
          Please upload a logo to continue
        </p>
      )}
    </div>
  )
}
