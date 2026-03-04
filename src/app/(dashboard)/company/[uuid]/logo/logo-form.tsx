'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Upload, X } from 'lucide-react'

interface LogoFormProps {
  readOnly?: boolean
  companyUuid: string
  currentLogoUrl: string
}

export function LogoForm({ readOnly, companyUuid, currentLogoUrl }: LogoFormProps) {
  const router = useRouter()
  const [logoUrl, setLogoUrl] = useState(currentLogoUrl)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  const handleLogoFile = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be under 5MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoError('Only PNG, JPG, and WebP files are supported')
      return
    }

    setLogoError(null)
    setIsUploadingLogo(true)

    try {
      const fd = new FormData()
      fd.append('logo', file)
      fd.append('companyUuid', companyUuid)

      const response = await fetch('/api/company/logo', {
        method: 'POST',
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload logo')
      }

      const data = await response.json()
      setLogoUrl(data.logoUrl)
      router.refresh()
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingLogo(false)
    }
  }, [companyUuid, router])

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    handleLogoFile(file)
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleLogoFile(file)
    }
  }, [handleLogoFile])

  const handleRemoveLogo = async () => {
    setLogoError(null)
    try {
      const response = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: companyUuid, logoUrl: '' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove logo')
      }

      setLogoUrl('')
      router.refresh()
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Failed to remove logo')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
      </CardHeader>
      <CardContent>
        {readOnly ? (
          logoUrl ? (
            <div className="h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center p-3">
              <img src={logoUrl} alt="Logo" className="max-h-20 w-auto object-contain" />
            </div>
          ) : (
            <div className="h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
              <p className="text-xs text-gray-400">No logo</p>
            </div>
          )
        ) : (
          <label
            className="relative block cursor-pointer group"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleLogoSelect}
              disabled={isUploadingLogo}
            />
            <div
              className={`relative h-32 rounded-xl border-2 border-dashed transition-all ${
                isDragging
                  ? 'border-cyan-700 bg-gray-50 scale-[1.02]'
                  : 'border-gray-300 bg-gray-50 hover:border-cyan-600 hover:bg-cyan-800/5'
              }`}
            >
              {isUploadingLogo ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-cyan-700 mb-2" />
                  <p className="text-xs text-gray-500">Uploading...</p>
                </div>
              ) : logoUrl ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center p-3">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="max-h-20 w-auto object-contain"
                    />
                  </div>
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 rounded-xl transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                      <p className="text-xs font-medium text-gray-700">Click to replace</p>
                    </div>
                  </div>
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemoveLogo()
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 hover:bg-red-50 border border-gray-200 hover:border-red-300 text-gray-500 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-cyan-800/10 flex items-center justify-center mb-2 transition-colors">
                    <Upload className="h-5 w-5 text-gray-400 group-hover:text-cyan-700 transition-colors" />
                  </div>
                  <p className="text-xs font-medium text-gray-600">Upload logo</p>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP</p>
                </div>
              )}
            </div>
          </label>
        )}
        {logoError && (
          <p className="text-sm text-red-600 mt-1">{logoError}</p>
        )}
      </CardContent>
    </Card>
  )
}
