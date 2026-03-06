'use client'

import { useCallback, useState } from 'react'
import * as filestack from 'filestack-js'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

export interface FilestackResult {
  url: string
  filename: string
  size: number
  mimetype: string
  handle: string
}

interface FilestackPickerProps {
  onUploadComplete: (result: FilestackResult) => void
  accept?: string[]
  maxSize?: number
  transformations?: {
    crop?: boolean | { aspectRatio?: number; force?: boolean }
    resize?: { width?: number; height?: number; fit?: 'clip' | 'crop' | 'scale' | 'max' }
  }
  buttonText?: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost'
  className?: string
}

const FILESTACK_API_KEY = process.env.NEXT_PUBLIC_FILESTACK_KEY || ''

export function FilestackPicker({
  onUploadComplete,
  accept = ['image/*'],
  maxSize = 10 * 1024 * 1024, // 10MB default
  transformations,
  buttonText = 'Upload Image',
  buttonVariant = 'outline',
  className,
}: FilestackPickerProps) {
  const [isUploading, setIsUploading] = useState(false)

  const openPicker = useCallback(() => {
    if (!FILESTACK_API_KEY) {
      console.error('Filestack API key not configured')
      return
    }

    const client = filestack.init(FILESTACK_API_KEY)

    const pickerOptions: filestack.PickerOptions = {
      accept,
      maxSize,
      maxFiles: 1,
      uploadInBackground: false,
      onUploadStarted: () => {
        setIsUploading(true)
      },
      onUploadDone: (result) => {
        setIsUploading(false)
        if (result.filesUploaded.length > 0) {
          const file = result.filesUploaded[0]

          // Apply transformations if specified
          let finalUrl = file.url
          if (transformations) {
            const transforms: string[] = []

            if (transformations.resize) {
              const { width, height, fit = 'clip' } = transformations.resize
              const resizeParams = [
                width && `width:${width}`,
                height && `height:${height}`,
                `fit:${fit}`,
              ].filter(Boolean).join(',')
              transforms.push(`resize=${resizeParams}`)
            }

            if (transforms.length > 0) {
              finalUrl = `https://cdn.filestackcontent.com/${transforms.join('/')}/${file.handle}`
            }
          }

          onUploadComplete({
            url: finalUrl,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            handle: file.handle,
          })
        }
      },
      onCancel: () => {
        setIsUploading(false)
      },
      onFileUploadFailed: () => {
        setIsUploading(false)
      },
    }

    // Add crop transformation to picker if specified
    if (transformations?.crop) {
      pickerOptions.transformations = {
        crop: transformations.crop === true ? {} : transformations.crop,
      }
    }

    client.picker(pickerOptions).open()
  }, [accept, maxSize, onUploadComplete, transformations])

  return (
    <Button
      type="button"
      variant={buttonVariant}
      onClick={openPicker}
      disabled={isUploading || !FILESTACK_API_KEY}
      className={className}
    >
      {isUploading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading...
        </>
      ) : (
        <>
          <Upload className="h-4 w-4" />
          {buttonText}
        </>
      )}
    </Button>
  )
}
