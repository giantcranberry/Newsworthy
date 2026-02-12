'use client'

import { useState, useCallback, useEffect } from 'react'
import Cropper, { Area } from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ZoomIn, ZoomOut, Crop, Maximize } from 'lucide-react'

interface ImageCropperProps {
  imageSrc: string
  open: boolean
  onClose: () => void
  onCropComplete: (croppedFile: File, croppedPreview: string) => void
  aspectRatio?: number
  targetWidth?: number
  targetHeight?: number
  mode?: 'banner' | 'news'
}

type FitMode = 'crop' | 'fit'

// Create the cropped image from canvas
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  targetWidth: number,
  targetHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  canvas.width = targetWidth
  canvas.height = targetHeight

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

// Create image with blurred background fill
async function getFittedImg(
  imageSrc: string,
  targetWidth: number,
  targetHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  canvas.width = targetWidth
  canvas.height = targetHeight

  // Calculate scale to fit the entire image
  const scale = Math.min(
    targetWidth / image.width,
    targetHeight / image.height
  )

  const scaledWidth = image.width * scale
  const scaledHeight = image.height * scale
  const x = (targetWidth - scaledWidth) / 2
  const y = (targetHeight - scaledHeight) / 2

  // Draw blurred background (scaled up to fill, then blurred)
  ctx.filter = 'blur(30px)'

  const bgScale =
    Math.max(targetWidth / image.width, targetHeight / image.height) * 1.1

  const bgWidth = image.width * bgScale
  const bgHeight = image.height * bgScale
  const bgX = (targetWidth - bgWidth) / 2
  const bgY = (targetHeight - bgHeight) / 2

  ctx.drawImage(image, bgX, bgY, bgWidth, bgHeight)

  // Add a slight dark overlay for better contrast
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Draw the main image (sharp, centered)
  ctx.drawImage(image, x, y, scaledWidth, scaledHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

// Crop image at natural dimensions, capped at maxWidth x maxHeight
async function getCroppedImgNatural(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth: number,
  maxHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new Image()
  image.src = imageSrc

  await new Promise((resolve) => {
    image.onload = resolve
  })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  // Use the crop area dimensions, capped at max
  let outW = pixelCrop.width
  let outH = pixelCrop.height
  if (outW > maxWidth || outH > maxHeight) {
    const scale = Math.min(maxWidth / outW, maxHeight / outH)
    outW = Math.round(outW * scale)
    outH = Math.round(outH * scale)
  }

  canvas.width = outW
  canvas.height = outH

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outW,
    outH
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

export function ImageCropper({
  imageSrc,
  open,
  onClose,
  onCropComplete,
  aspectRatio = 1200 / 630,
  targetWidth = 1200,
  targetHeight = 630,
  mode = 'banner',
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processing, setProcessing] = useState(false)
  const [fitMode, setFitMode] = useState<FitMode>('fit')
  const [fitPreview, setFitPreview] = useState<string | null>(null)

  // Generate fit preview when mode changes
  useEffect(() => {
    if (fitMode === 'fit' && imageSrc) {
      getFittedImg(imageSrc, targetWidth, targetHeight)
        .then(({ preview }) => setFitPreview(preview))
        .catch(console.error)
    }
  }, [fitMode, imageSrc, targetWidth, targetHeight])

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location)
  }, [])

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom)
  }, [])

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleSave = async () => {
    setProcessing(true)
    try {
      if (mode === 'news') {
        if (!croppedAreaPixels) return
        const { file, preview } = await getCroppedImgNatural(
          imageSrc,
          croppedAreaPixels,
          1200,
          800
        )
        onCropComplete(file, preview)
      } else if (fitMode === 'fit') {
        const { file, preview } = await getFittedImg(
          imageSrc,
          targetWidth,
          targetHeight
        )
        onCropComplete(file, preview)
      } else {
        if (!croppedAreaPixels) return
        const { file, preview } = await getCroppedImg(
          imageSrc,
          croppedAreaPixels,
          targetWidth,
          targetHeight
        )
        onCropComplete(file, preview)
      }
      onClose()
    } catch (error) {
      console.error('Error processing image:', error)
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setFitMode('crop')
    setFitPreview(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === 'news' ? 'Crop Image' : 'Adjust Banner Image'}</DialogTitle>
          <DialogDescription>
            {mode === 'news'
              ? 'Optionally adjust crop or apply as-is.'
              : 'Choose how to fit your image to the recommended 1200x630 dimensions.'}
          </DialogDescription>
        </DialogHeader>

        {mode === 'banner' && (
          <Tabs value={fitMode} onValueChange={(v) => setFitMode(v as FitMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="crop" className="flex items-center gap-2">
                <Crop className="h-4 w-4" />
                Crop to Fill
              </TabsTrigger>
              <TabsTrigger value="fit" className="flex items-center gap-2">
                <Maximize className="h-4 w-4" />
                Fit with Background
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {mode === 'news' ? (
          <>
            <div className="relative h-[400px] bg-gray-100 rounded-lg overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ZoomOut className="h-4 w-4 text-gray-400" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="flex-1"
                />
                <ZoomIn className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Use the slider to zoom, drag the image to reposition
              </p>
            </div>
          </>
        ) : fitMode === 'crop' ? (
          <>
            <div className="relative h-[400px] bg-gray-100 rounded-lg overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropCompleteCallback}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <ZoomOut className="h-4 w-4 text-gray-400" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(value) => setZoom(value[0])}
                  className="flex-1"
                />
                <ZoomIn className="h-4 w-4 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">
                Use the slider to zoom, drag the image to reposition
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="relative h-[400px] bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
              {fitPreview ? (
                <img
                  src={fitPreview}
                  alt="Fit preview"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating preview...
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500 text-center">
              Your image will be centered with a blurred background fill
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={processing || (mode === 'banner' && fitMode === 'fit' && !fitPreview)}
          >
            {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
