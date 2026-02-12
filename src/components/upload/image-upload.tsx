'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImageUploadProps {
  onFileSelect: (file: File, preview: string) => void
  onClear?: () => void
  accept?: string
  maxSize?: number // in bytes
  buttonText?: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost'
  className?: string
  disabled?: boolean
  showPreview?: boolean
  previewUrl?: string | null
}

export function ImageUpload({
  onFileSelect,
  onClear,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml',
  maxSize = 10 * 1024 * 1024, // 10MB default
  buttonText = 'Upload Image',
  buttonVariant = 'outline',
  className,
  disabled = false,
  showPreview = false,
  previewUrl,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(previewUrl || null)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file size
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`)
      return
    }

    // Validate file type
    const acceptedTypes = accept.split(',').map((t) => t.trim())
    if (!acceptedTypes.some((type) => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.replace('/*', '/'))
      }
      return file.type === type
    })) {
      setError('Invalid file type')
      return
    }

    // Generate preview
    const reader = new FileReader()
    reader.onloadend = () => {
      const previewUrl = reader.result as string
      setPreview(previewUrl)
      onFileSelect(file, previewUrl)
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleClear = () => {
    setPreview(null)
    setError(null)
    onClear?.()
  }

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={buttonVariant}
          onClick={handleClick}
          disabled={disabled}
        >
          <Upload className="h-4 w-4" />
          {buttonText}
        </Button>

        {preview && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-gray-500"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {showPreview && preview && (
        <div className="mt-2">
          <img
            src={preview}
            alt="Preview"
            className="max-w-xs max-h-32 rounded-lg border object-contain"
          />
        </div>
      )}
    </div>
  )
}

interface UploadingImageProps {
  isUploading: boolean
  children: React.ReactNode
}

export function UploadingOverlay({ isUploading, children }: UploadingImageProps) {
  return (
    <div className="relative">
      {children}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </div>
        </div>
      )}
    </div>
  )
}
