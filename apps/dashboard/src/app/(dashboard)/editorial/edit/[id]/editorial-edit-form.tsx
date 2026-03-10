'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const Editor = dynamic(
  () => import('@tinymce/tinymce-react').then((mod) => mod.Editor),
  { ssr: false, loading: () => <div className="h-[500px] bg-gray-50 dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800 animate-pulse" /> },
)

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
import { TIMEZONES, normalizeTimezone } from '@/lib/timezones'
import Cropper, { Area } from 'react-easy-crop'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft,
  Check,
  Crop as CropIcon,
  ImageIcon,
  Loader2,
  Maximize,
  Pencil,
  Save,
  Star,
  Upload,
  UserCog,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

interface ImageRecord {
  id: number
  uuid: string
  url: string
  title?: string | null
  imgCredits?: string | null
}

interface BannerRecord {
  id: number
  uuid: string
  url: string
  title?: string | null
  imgCredits?: string | null
}

interface ReleaseImageRecord {
  id: number
  imageId: number
  sortOrder: number
  image: ImageRecord
}

interface EditorialEditFormProps {
  release: {
    id: number
    uuid: string
    status: string | null
    title: string
    abstract: string
    body: string
    pullquote: string
    location: string
    videoUrl: string
    landingPage: string
    publicDrive: string
    releaseAt: string | null
    timezone: string
    primaryContactId: number | null
  }
  company: {
    id: number
    name: string
    timezone: string
  }
  contacts: {
    id: number
    uuid: string
    name: string
    email: string
  }[]
  topCategories: {
    id: number
    name: string
  }[]
  allCategories: {
    id: number
    name: string
    parentCategory: string
  }[]
  allRegions: {
    id: number
    name: string
    state: string
  }[]
  selectedCategoryIds: number[]
  selectedRegionIds: number[]
  releaseImages: ReleaseImageRecord[]
  banner: BannerRecord | null
  owner: { id: number; email: string } | null
}

type FitMode = 'crop' | 'fit'

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  targetWidth: number,
  targetHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new window.Image()
  image.src = imageSrc
  await new Promise((resolve) => { image.onload = resolve })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = targetWidth
  canvas.height = targetHeight

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, targetWidth, targetHeight
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

async function getFittedImg(
  imageSrc: string,
  targetWidth: number,
  targetHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new window.Image()
  image.src = imageSrc
  await new Promise((resolve) => { image.onload = resolve })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  canvas.width = targetWidth
  canvas.height = targetHeight

  const scale = Math.min(targetWidth / image.width, targetHeight / image.height)
  const scaledWidth = image.width * scale
  const scaledHeight = image.height * scale
  const x = (targetWidth - scaledWidth) / 2
  const y = (targetHeight - scaledHeight) / 2

  // Blurred background
  ctx.filter = 'blur(30px)'
  const bgScale = Math.max(targetWidth / image.width, targetHeight / image.height) * 1.1
  const bgWidth = image.width * bgScale
  const bgHeight = image.height * bgScale
  const bgX = (targetWidth - bgWidth) / 2
  const bgY = (targetHeight - bgHeight) / 2
  ctx.drawImage(image, bgX, bgY, bgWidth, bgHeight)

  // Dark overlay
  ctx.filter = 'none'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
  ctx.fillRect(0, 0, targetWidth, targetHeight)

  // Sharp centered image
  ctx.drawImage(image, x, y, scaledWidth, scaledHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        const file = new File([blob], 'banner.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

async function getCroppedImgNatural(
  imageSrc: string,
  pixelCrop: Area,
  maxWidth: number,
  maxHeight: number
): Promise<{ file: File; preview: string }> {
  const image = new window.Image()
  image.src = imageSrc
  await new Promise((resolve) => { image.onload = resolve })

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

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
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, outW, outH
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return }
        const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })
        const preview = canvas.toDataURL('image/jpeg', 0.9)
        resolve({ file, preview })
      },
      'image/jpeg',
      0.9
    )
  })
}

/**
 * Convert a date string + time string in a given IANA timezone to a UTC Date.
 */
function toUTCFromTimezone(date: string, time: string, tz: string): Date {
  const localStr = `${date}T${time}:00`
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const naive = new Date(localStr)
  const utcParts = formatter.formatToParts(naive)
  const get = (type: string) => utcParts.find((p) => p.type === type)?.value || '0'
  const inTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  )
  const offsetMs = inTz.getTime() - naive.getTime()
  return new Date(naive.getTime() - offsetMs)
}

function resizedUrl(url: string) {
  if (url.includes('RESIZE')) {
    return url.replace('RESIZE', 'resize=width:300')
  }
  return url
}

export function EditorialEditForm({
  release,
  company,
  contacts,
  topCategories,
  allCategories,
  allRegions,
  selectedCategoryIds,
  selectedRegionIds,
  releaseImages: initialImages,
  banner: initialBanner,
  owner,
}: EditorialEditFormProps) {
  const router = useRouter()
  const editorRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [impersonating, setImpersonating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [title, setTitle] = useState(release.title)
  const [abstract, setAbstract] = useState(release.abstract)
  const [pullquote, setPullquote] = useState(release.pullquote)
  const [location, setLocation] = useState(release.location)
  const [videoUrl, setVideoUrl] = useState(release.videoUrl)
  const [landingPage, setLandingPage] = useState(release.landingPage)
  const [publicDrive, setPublicDrive] = useState(release.publicDrive)
  const [primaryContactId, setPrimaryContactId] = useState(release.primaryContactId?.toString() || '')

  // Parse release date/time in the release's timezone (not UTC)
  const effectiveTimezone = normalizeTimezone(release.timezone || company.timezone)
  const initialDateTime = (() => {
    if (!release.releaseAt) return null
    const d = new Date(release.releaseAt)
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: effectiveTimezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: effectiveTimezone,
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(d)
    const h = parts.find((p) => p.type === 'hour')?.value || '06'
    const m = parts.find((p) => p.type === 'minute')?.value || '00'
    return { date: dateStr, time: `${h}:${m}` }
  })()
  const [releaseDateStr, setReleaseDateStr] = useState(initialDateTime?.date || '')
  const [releaseTimeStr, setReleaseTimeStr] = useState(initialDateTime?.time || '06:00')
  const [timezone, setTimezone] = useState(effectiveTimezone)

  // Determine initial topcat from selected categories
  const initialTopcat = selectedCategoryIds.find((id) =>
    topCategories.some((tc) => tc.id === id)
  )
  const [topcat, setTopcat] = useState(initialTopcat?.toString() || '')
  const [regionIds, setRegionIds] = useState<number[]>(selectedRegionIds)

  const regionOptions = allRegions.map((r) => ({
    value: r.id,
    label: `${r.state}: ${r.name}`,
  }))

  // Image management state
  const [currentBanner, setCurrentBanner] = useState<BannerRecord | null>(initialBanner)
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingBanner, setIsUploadingBanner] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [cropState, setCropState] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [fitMode, setFitMode] = useState<FitMode>('fit')
  const [fitPreview, setFitPreview] = useState<string | null>(null)
  const [cropProcessing, setCropProcessing] = useState(false)
  const [releaseImages, setReleaseImages] = useState<ReleaseImageRecord[]>(initialImages)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [replacingId, setReplacingId] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  // Metadata prompt for new upload
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newCredits, setNewCredits] = useState('')
  // Editing existing image metadata
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCredits, setEditCredits] = useState('')
  // News image cropper state
  const [newsCropperSrc, setNewsCropperSrc] = useState<string | null>(null)
  const [showNewsCropper, setShowNewsCropper] = useState(false)
  const [newsCrop, setNewsCrop] = useState({ x: 0, y: 0 })
  const [newsZoom, setNewsZoom] = useState(1)
  const [newsCroppedArea, setNewsCroppedArea] = useState<Area | null>(null)
  const [newsCropProcessing, setNewsCropProcessing] = useState(false)
  const [newsRawFile, setNewsRawFile] = useState<File | null>(null)
  // Replace image cropper state
  const [replaceImageId, setReplaceImageId] = useState<number | null>(null)

  const processImageFile = useCallback((file: File, forReplaceId?: number) => {
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Only JPEG, PNG, and WebP images are supported')
      return
    }
    setImageError(null)
    setNewsRawFile(file)
    setReplaceImageId(forReplaceId ?? null)

    const reader = new FileReader()
    reader.onloadend = () => {
      setNewsCropperSrc(reader.result as string)
      setShowNewsCropper(true)
      setNewsCrop({ x: 0, y: 0 })
      setNewsZoom(1)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    processImageFile(file)
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
    if (file) processImageFile(file)
  }, [processImageFile])

  const handleUploadImage = async () => {
    if (!pendingFile) return
    if (!newTitle.trim()) {
      setImageError('Alt description is required')
      return
    }

    setIsUploadingImage(true)
    setImageError(null)

    try {
      const formData = new FormData()
      formData.append('image', pendingFile)
      formData.append('title', newTitle.trim())
      if (newCredits.trim()) formData.append('imgCredits', newCredits.trim())

      const response = await fetch(`/api/pr/${release.uuid}/image`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      const data = await response.json()
      setReleaseImages((prev) => [...prev, data.releaseImage])
      setPendingFile(null)
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
      setPendingPreview(null)
      setNewTitle('')
      setNewCredits('')
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleNewsCropApply = async () => {
    if (!newsCropperSrc || !newsCroppedArea) return
    setNewsCropProcessing(true)

    try {
      const { file, preview } = await getCroppedImgNatural(newsCropperSrc, newsCroppedArea, 1200, 800)
      setShowNewsCropper(false)
      setNewsCropperSrc(null)

      if (replaceImageId) {
        // Replace flow: upload immediately with existing metadata
        setReplacingId(replaceImageId)
        setImageError(null)

        try {
          await fetch(`/api/pr/${release.uuid}/image?imageId=${replaceImageId}`, { method: 'DELETE' })
          const existingImage = releaseImages.find((ri) => ri.imageId === replaceImageId)
          const altText = existingImage?.image.title || 'Release image'
          const credits = existingImage?.image.imgCredits || ''

          const formData = new FormData()
          formData.append('image', file)
          formData.append('title', altText)
          if (credits) formData.append('imgCredits', credits)

          const response = await fetch(`/api/pr/${release.uuid}/image`, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to upload replacement image')
          }

          const data = await response.json()
          setReleaseImages((prev) => {
            const filtered = prev.filter((ri) => ri.imageId !== replaceImageId)
            return [...filtered, data.releaseImage]
          })
        } catch (err) {
          setImageError(err instanceof Error ? err.message : 'Failed to replace image')
        } finally {
          setReplacingId(null)
          setReplaceImageId(null)
        }
      } else {
        // New image flow: show metadata prompt
        setPendingFile(file)
        setPendingPreview(preview)
        setNewTitle('')
        setNewCredits('')
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setNewsCropProcessing(false)
    }
  }

  const handleNewsCropApplyOriginal = () => {
    // Use original without cropping — go straight to metadata or replace
    if (!newsRawFile) return
    setShowNewsCropper(false)
    setNewsCropperSrc(null)

    if (replaceImageId) {
      // Replace flow with original file
      const file = newsRawFile
      setReplacingId(replaceImageId)
      setImageError(null)

      ;(async () => {
        try {
          await fetch(`/api/pr/${release.uuid}/image?imageId=${replaceImageId}`, { method: 'DELETE' })
          const existingImage = releaseImages.find((ri) => ri.imageId === replaceImageId)
          const altText = existingImage?.image.title || 'Release image'
          const credits = existingImage?.image.imgCredits || ''

          const formData = new FormData()
          formData.append('image', file)
          formData.append('title', altText)
          if (credits) formData.append('imgCredits', credits)

          const response = await fetch(`/api/pr/${release.uuid}/image`, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to upload replacement image')
          }

          const data = await response.json()
          setReleaseImages((prev) => {
            const filtered = prev.filter((ri) => ri.imageId !== replaceImageId)
            return [...filtered, data.releaseImage]
          })
        } catch (err) {
          setImageError(err instanceof Error ? err.message : 'Failed to replace image')
        } finally {
          setReplacingId(null)
          setReplaceImageId(null)
        }
      })()
    } else {
      // New image flow with original file
      setPendingFile(newsRawFile)
      setPendingPreview(URL.createObjectURL(newsRawFile))
      setNewTitle('')
      setNewCredits('')
    }
  }

  const handleNewsCropCancel = () => {
    setShowNewsCropper(false)
    setNewsCropperSrc(null)
    setNewsRawFile(null)
    setReplaceImageId(null)
    setNewsCrop({ x: 0, y: 0 })
    setNewsZoom(1)
  }

  const handleCancelUpload = () => {
    setPendingFile(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    setNewTitle('')
    setNewCredits('')
  }

  const handleDeleteImage = async (imageId: number) => {
    setDeletingId(imageId)
    setImageError(null)

    try {
      const response = await fetch(
        `/api/pr/${release.uuid}/image?imageId=${imageId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove image')
      }

      setReleaseImages((prev) => prev.filter((ri) => ri.imageId !== imageId))
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to remove image')
    } finally {
      setDeletingId(null)
    }
  }

  const handleReplaceImage = (oldImageId: number, file: File) => {
    processImageFile(file, oldImageId)
  }

  const handleStartEdit = (ri: ReleaseImageRecord) => {
    setEditingId(ri.imageId)
    setEditTitle(ri.image.title || '')
    setEditCredits(ri.image.imgCredits || '')
  }

  const handleSaveEdit = async (imageId: number) => {
    setImageError(null)

    try {
      const response = await fetch(`/api/pr/${release.uuid}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, title: editTitle, imgCredits: editCredits }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update image')
      }

      setReleaseImages((prev) =>
        prev.map((ri) =>
          ri.imageId === imageId
            ? { ...ri, image: { ...ri.image, title: editTitle, imgCredits: editCredits } }
            : ri
        )
      )
      setEditingId(null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to update image')
    }
  }

  const handleBannerFileSelect = useCallback((file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      setBannerError('Banner must be under 10MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setBannerError('Only JPEG, PNG, and WebP images are supported')
      return
    }

    setBannerError(null)

    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string

      const img = new window.Image()
      img.onload = () => {
        if (img.width === 1200 && img.height === 630) {
          setBannerFile(file)
          setBannerPreview(dataUrl)
        } else {
          setCropperImageSrc(dataUrl)
          setShowCropper(true)
          setFitMode('fit')
          setCropState({ x: 0, y: 0 })
          setCropZoom(1)
          setFitPreview(null)
          // Generate fit preview immediately
          getFittedImg(dataUrl, 1200, 630)
            .then(({ preview }) => setFitPreview(preview))
            .catch(console.error)
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }, [])

  const handleCropperApply = async () => {
    if (!cropperImageSrc) return
    setCropProcessing(true)

    try {
      if (fitMode === 'fit') {
        const { file, preview } = await getFittedImg(cropperImageSrc, 1200, 630)
        setBannerFile(file)
        setBannerPreview(preview)
      } else {
        if (!croppedAreaPixels) return
        const { file, preview } = await getCroppedImg(cropperImageSrc, croppedAreaPixels, 1200, 630)
        setBannerFile(file)
        setBannerPreview(preview)
      }
      setShowCropper(false)
      setCropperImageSrc(null)
    } catch (error) {
      console.error('Error processing image:', error)
    } finally {
      setCropProcessing(false)
    }
  }

  const handleCropperCancel = () => {
    setShowCropper(false)
    setCropperImageSrc(null)
    setCropState({ x: 0, y: 0 })
    setCropZoom(1)
    setFitMode('fit')
    setFitPreview(null)
  }

  const handleRecrop = () => {
    if (bannerPreview) {
      setCropperImageSrc(bannerPreview)
      setShowCropper(true)
      setFitMode('fit')
      setCropState({ x: 0, y: 0 })
      setCropZoom(1)
      getFittedImg(bannerPreview, 1200, 630)
        .then(({ preview }) => setFitPreview(preview))
        .catch(console.error)
    }
  }

  const handleSaveBanner = async () => {
    if (!bannerFile) return

    setIsUploadingBanner(true)
    setBannerError(null)

    try {
      const fd = new FormData()
      fd.append('banner', bannerFile)
      fd.append('title', currentBanner?.title || release.title || '')
      if (currentBanner?.imgCredits) fd.append('imgCredits', currentBanner.imgCredits)

      const response = await fetch(`/api/pr/${release.uuid}/social`, {
        method: 'POST',
        body: fd,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload banner')
      }

      const data = await response.json()
      setCurrentBanner(data.banner)
      setBannerFile(null)
      setBannerPreview(null)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to replace banner')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  // Regenerate fit preview when switching to fit mode
  const handleFitModeChange = (mode: string) => {
    setFitMode(mode as FitMode)
    if (mode === 'fit' && cropperImageSrc) {
      getFittedImg(cropperImageSrc, 1200, 630)
        .then(({ preview }) => setFitPreview(preview))
        .catch(console.error)
    }
  }

  const handleRemoveBanner = async () => {
    setIsUploadingBanner(true)
    setBannerError(null)

    try {
      const response = await fetch(`/api/pr/${release.uuid}/social`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove banner')
      }

      setCurrentBanner(null)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to remove banner')
    } finally {
      setIsUploadingBanner(false)
    }
  }

  const handleImpersonate = async () => {
    if (!owner) return
    setImpersonating(true)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: owner.id }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to impersonate user')
      }
      router.push('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Impersonation error:', error)
      alert(error instanceof Error ? error.message : 'Failed to impersonate user')
    } finally {
      setImpersonating(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // Get body content from TinyMCE
    const bodyContent = editorRef.current?.getContent() || ''

    // Combine topcat with category IDs
    const allCategoryIds: number[] = []
    if (topcat) {
      allCategoryIds.push(parseInt(topcat))
    }

    try {
      const res = await fetch('/api/editorial/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          releaseId: release.id,
          title,
          abstract,
          body: bodyContent,
          pullquote,
          location,
          videoUrl,
          landingPage,
          publicDrive,
          primaryContactId: primaryContactId ? parseInt(primaryContactId) : null,
          releaseDate: releaseDateStr,
          releaseTime: releaseTimeStr,
          timezone,
          categoryIds: allCategoryIds,
          regionIds,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'Release updated successfully.' })
        if (release.status === 'sent') {
          router.push('/editorial/released-edit')
        } else if (release.status === 'approved') {
          router.push('/editorial/pending')
        } else {
          router.push(`/editorial/review/${release.uuid}`)
        }
        router.refresh()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update release.' })
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to update release.' })
    } finally {
      setLoading(false)
    }
  }

  const backHref = release.status === 'sent'
    ? '/editorial/released-edit'
    : release.status === 'approved'
      ? '/editorial/pending'
      : `/editorial/review/${release.uuid}`
  const backLabel = release.status === 'sent'
    ? 'Back to Edit Released'
    : release.status === 'approved'
      ? 'Back to Pending'
      : 'Back to Review'

  return (
    <>
      <div className="space-y-3">
        <Link href={backHref} className="inline-flex items-center text-sm text-cyan-800 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 font-medium">
          <ArrowLeft className="h-4 w-4 mr-1" />
          {backLabel}
        </Link>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
          Editorial Edit &mdash; PR #{release.id}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">{company.name}</p>
          {owner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-amber-600 border-amber-300 hover:bg-amber-50 h-7 text-xs">
                  <UserCog className="h-3.5 w-3.5 mr-1" />
                  Impersonate User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Impersonate User</AlertDialogTitle>
                  <AlertDialogDescription>
                    You are about to impersonate <strong>{owner.email}</strong>. You will see the application as this user would see it.
                    <br /><br />
                    A banner will be displayed at the top of the page while impersonating. Click &quot;Stop Impersonating&quot; to return to your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleImpersonate}
                    disabled={impersonating}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {impersonating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Impersonating...
                      </>
                    ) : (
                      'Start Impersonation'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {message && (
        <div className={`rounded-md p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 dark:text-green-400' : 'bg-red-50 text-red-800 dark:text-red-400'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Core Content */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Headline ({title.length}/180)</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1"
                maxLength={180}
              />
            </div>

            <div>
              <Label htmlFor="abstract">Abstract / Summary ({abstract.length}/350)</Label>
              <textarea
                id="abstract"
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                className="mt-1 w-full h-20 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700 resize-none text-sm"
                maxLength={350}
              />
            </div>

            <div>
              <Label htmlFor="pullquote">Notable Quote</Label>
              <textarea
                id="pullquote"
                value={pullquote}
                onChange={(e) => setPullquote(e.target.value)}
                className="mt-1 w-full h-16 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700 resize-none text-sm"
              />
            </div>

            <div>
              <Label>Content (Press Release Body)</Label>
              <div className="mt-1">
                <Editor
                  apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
                  onInit={(evt, editor) => (editorRef.current = editor)}
                  initialValue={release.body}
                  init={{
                    height: 500,
                    menubar: false,
                    plugins: [
                      'advlist',
                      'autolink',
                      'lists',
                      'link',
                      'charmap',
                      'searchreplace',
                      'visualblocks',
                      'code',
                      'insertdatetime',
                      'table',
                      'help',
                      'wordcount',
                    ],
                    toolbar:
                      'undo redo | blocks | ' +
                      'bold italic | alignleft aligncenter ' +
                      'alignright alignjustify | bullist numlist outdent indent | ' +
                      'link | removeformat | wordcount',
                    toolbar_sticky: true,
                    toolbar_sticky_offset: 0,
                    content_style:
                      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 14px; line-height: 1.6; }',
                    branding: false,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Banner */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Social Banner</CardTitle>
            <CardDescription>This image appears when the press release is shared on social media (1200 x 630px)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bannerError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">
                {bannerError}
              </div>
            )}

            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleBannerFileSelect(file)
                e.target.value = ''
              }}
            />

            <Dialog open={showCropper} onOpenChange={(isOpen) => !isOpen && handleCropperCancel()}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Adjust Banner Image</DialogTitle>
                  <DialogDescription>
                    Choose how to fit your image to the recommended 1200x630 dimensions.
                  </DialogDescription>
                </DialogHeader>

                <Tabs value={fitMode} onValueChange={handleFitModeChange}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="crop" className="flex items-center gap-2">
                      <CropIcon className="h-4 w-4" />
                      Crop to Fill
                    </TabsTrigger>
                    <TabsTrigger value="fit" className="flex items-center gap-2">
                      <Maximize className="h-4 w-4" />
                      Fit with Background
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {fitMode === 'crop' ? (
                  <>
                    <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      {cropperImageSrc && (
                        <Cropper
                          image={cropperImageSrc}
                          crop={cropState}
                          zoom={cropZoom}
                          aspect={1200 / 630}
                          onCropChange={setCropState}
                          onZoomChange={setCropZoom}
                          onCropComplete={(_area, areaPixels) => setCroppedAreaPixels(areaPixels)}
                        />
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <ZoomOut className="h-4 w-4 text-gray-400" />
                        <Slider
                          value={[cropZoom]}
                          min={1}
                          max={3}
                          step={0.1}
                          onValueChange={(value) => setCropZoom(value[0])}
                          className="flex-1"
                        />
                        <ZoomIn className="h-4 w-4 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        Use the slider to zoom, drag the image to reposition
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
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
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                      Your image will be centered with a blurred background fill
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={handleCropperCancel} disabled={cropProcessing}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCropperApply}
                    disabled={cropProcessing || (fitMode === 'fit' && !fitPreview)}
                  >
                    {cropProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Apply
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Show banner preview (new upload or existing) */}
            {(bannerPreview || currentBanner) && (
              <div className="space-y-3">
                <div className="max-w-[50%]">
                  <div className="relative rounded-lg overflow-hidden border bg-gray-50 dark:bg-gray-950" style={{ aspectRatio: '1200/630' }}>
                    <Image
                      src={bannerPreview ? bannerPreview : resizedUrl(currentBanner!.url)}
                      alt={currentBanner?.title || 'Social banner'}
                      fill
                      className="object-cover"
                      unoptimized={!!bannerPreview}
                    />
                    {bannerPreview && (
                      <div className="absolute top-2 right-2">
                        <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-0.5 rounded-full">
                          <Check className="h-3 w-3" />
                          New
                        </span>
                      </div>
                    )}
                    {isUploadingBanner && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900/80">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400" />
                      </div>
                    )}
                  </div>
                </div>
                {currentBanner?.title && !bannerPreview && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Alt: {currentBanner.title}</p>
                )}
                {currentBanner?.imgCredits && !bannerPreview && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Credits: {currentBanner.imgCredits}</p>
                )}
                <div className="flex gap-2">
                  {bannerPreview && (
                    <>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700"
                        onClick={handleSaveBanner}
                        disabled={isUploadingBanner}
                      >
                        {isUploadingBanner ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Banner
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRecrop}
                        disabled={isUploadingBanner}
                      >
                        <CropIcon className="h-4 w-4" />
                        Re-crop
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => { setBannerFile(null); setBannerPreview(null) }}
                        disabled={isUploadingBanner}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                  {!bannerPreview && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => bannerFileInputRef.current?.click()}
                        disabled={isUploadingBanner}
                      >
                        <Upload className="h-4 w-4" />
                        Replace Banner
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400"
                        onClick={handleRemoveBanner}
                        disabled={isUploadingBanner}
                      >
                        <X className="h-4 w-4" />
                        Remove
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Upload dropzone — show when no banner and no preview */}
            {!bannerPreview && !currentBanner && (
              <div
                onClick={() => bannerFileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-700 hover:bg-cyan-50 dark:bg-cyan-900/30/50"
              >
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-2">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Upload a banner image, or <span className="text-cyan-700">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PNG, JPEG, or WebP up to 10MB &middot; 1200 x 630px recommended
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* News Images */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>News Images</CardTitle>
            <CardDescription>Manage press release images. The first image is the primary image.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {imageError && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">
                {imageError}
              </div>
            )}

            {/* News image cropper dialog */}
            <Dialog open={showNewsCropper} onOpenChange={(isOpen) => !isOpen && handleNewsCropCancel()}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Crop Image</DialogTitle>
                  <DialogDescription>
                    Optionally adjust crop or apply as-is.
                  </DialogDescription>
                </DialogHeader>

                <div className="relative h-[400px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                  {newsCropperSrc && (
                    <Cropper
                      image={newsCropperSrc}
                      crop={newsCrop}
                      zoom={newsZoom}
                      onCropChange={setNewsCrop}
                      onZoomChange={setNewsZoom}
                      onCropComplete={(_area, areaPixels) => setNewsCroppedArea(areaPixels)}
                    />
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <ZoomOut className="h-4 w-4 text-gray-400" />
                    <Slider
                      value={[newsZoom]}
                      min={1}
                      max={3}
                      step={0.1}
                      onValueChange={(value) => setNewsZoom(value[0])}
                      className="flex-1"
                    />
                    <ZoomIn className="h-4 w-4 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    Use the slider to zoom, drag the image to reposition
                  </p>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={handleNewsCropCancel} disabled={newsCropProcessing}>
                    Cancel
                  </Button>
                  <Button variant="outline" onClick={handleNewsCropApplyOriginal} disabled={newsCropProcessing}>
                    Use Original
                  </Button>
                  <Button onClick={handleNewsCropApply} disabled={newsCropProcessing || !newsCroppedArea}>
                    {newsCropProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Apply Crop
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Current images */}
            {releaseImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {releaseImages.map((ri, index) => (
                  <div key={ri.imageId} className="relative">
                    <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-900/50">
                      <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={resizedUrl(ri.image.url)}
                          alt={ri.image.title || 'Release image'}
                          fill
                          className="object-contain"
                        />

                        {index === 0 && (
                          <div className="absolute top-2 left-2">
                            <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full">
                              <Star className="h-3 w-3" />
                              Primary
                            </span>
                          </div>
                        )}

                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 bg-white dark:bg-gray-900/90 hover:bg-white dark:bg-gray-900"
                            onClick={() => handleStartEdit(ri)}
                            title="Edit details"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <label
                            className="inline-flex items-center justify-center h-7 w-7 bg-white dark:bg-gray-900/90 hover:bg-white dark:bg-gray-900 rounded-md cursor-pointer"
                            title="Replace image"
                          >
                            <Upload className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400" />
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleReplaceImage(ri.imageId, file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 bg-white dark:bg-gray-900/90 hover:bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400"
                            onClick={() => handleDeleteImage(ri.imageId)}
                            disabled={deletingId === ri.imageId}
                            title="Remove image"
                          >
                            {deletingId === ri.imageId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>

                        {replacingId === ri.imageId && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900/80">
                            <Loader2 className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
                          </div>
                        )}

                        {/* Alt text overlay */}
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1.5">
                          <p className="text-xs text-white truncate">
                            {ri.image.title || <span className="italic opacity-70">No alt description</span>}
                          </p>
                        </div>
                      </div>

                      {/* Edit metadata inline */}
                      {editingId === ri.imageId && (
                        <div className="p-3 space-y-2 border-t">
                          <div>
                            <Label htmlFor={`edit-title-${ri.imageId}`}>Alt Description</Label>
                            <Input
                              id={`edit-title-${ri.imageId}`}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Describe the image"
                              className="mt-1"
                              maxLength={255}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-credits-${ri.imageId}`}>Photo Credits</Label>
                            <Input
                              id={`edit-credits-${ri.imageId}`}
                              value={editCredits}
                              onChange={(e) => setEditCredits(e.target.value)}
                              placeholder="e.g., Photo by Jane Smith"
                              className="mt-1"
                              maxLength={128}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleSaveEdit(ri.imageId)}
                              disabled={!editTitle.trim()}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {releaseImages.length === 0 && !pendingFile && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-4">
                <ImageIcon className="h-5 w-5" />
                No images attached to this release.
              </div>
            )}

            {/* New image upload with metadata prompt */}
            {pendingFile && (
              <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                {pendingPreview && (
                  <div className="relative w-full max-w-xs aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img
                      src={pendingPreview}
                      alt="Selected image preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Image Details</h4>
                <div>
                  <Label htmlFor="new-title">Alt Description *</Label>
                  <Input
                    id="new-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Describe the image for accessibility"
                    className="mt-1"
                    maxLength={255}
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="new-credits">Photo Credits</Label>
                  <Input
                    id="new-credits"
                    value={newCredits}
                    onChange={(e) => setNewCredits(e.target.value)}
                    placeholder="e.g., Photo by Jane Smith"
                    className="mt-1"
                    maxLength={128}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={handleCancelUpload}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUploadImage}
                    disabled={!newTitle.trim() || isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Add Image'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Upload dropzone */}
            {!pendingFile && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragOver
                    ? 'border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30'
                    : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-700 hover:bg-cyan-50 dark:bg-cyan-900/30/50'
                }`}
              >
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-2">
                  <Upload className="h-5 w-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Drop an image here, or <span className="text-cyan-700">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  JPEG, PNG, or WebP up to 5MB
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="mt-1"
                  maxLength={120}
                />
              </div>

              <div>
                <Label htmlFor="primaryContact">Primary Contact</Label>
                <select
                  id="primaryContact"
                  value={primaryContactId}
                  onChange={(e) => setPrimaryContactId(e.target.value)}
                  className="mt-1 w-full h-9 px-3 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-cyan-700 focus:border-cyan-700"
                >
                  <option value="">Select contact...</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="releaseDate">Release Date</Label>
                <Input
                  id="releaseDate"
                  type="date"
                  value={releaseDateStr}
                  onChange={(e) => setReleaseDateStr(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="releaseTime">Release Time</Label>
                <Input
                  id="releaseTime"
                  type="time"
                  value={releaseTimeStr}
                  onChange={(e) => setReleaseTimeStr(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => {
                    const newTz = e.target.value
                    // Convert current date/time from old tz to new tz
                    if (releaseDateStr && releaseTimeStr) {
                      const utc = toUTCFromTimezone(releaseDateStr, releaseTimeStr, timezone)
                      const newDate = new Intl.DateTimeFormat('en-CA', {
                        timeZone: newTz, year: 'numeric', month: '2-digit', day: '2-digit',
                      }).format(utc)
                      const parts = new Intl.DateTimeFormat('en-US', {
                        timeZone: newTz, hour: '2-digit', minute: '2-digit', hour12: false,
                      }).formatToParts(utc)
                      const h = parts.find((p) => p.type === 'hour')?.value || '06'
                      const m = parts.find((p) => p.type === 'minute')?.value || '00'
                      setReleaseDateStr(newDate)
                      setReleaseTimeStr(`${h}:${m}`)
                    }
                    setTimezone(newTz)
                  }}
                  className="mt-1"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="videoUrl">Video URL</Label>
                <Input
                  id="videoUrl"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="landingPage">Landing Page URL</Label>
                <Input
                  id="landingPage"
                  value={landingPage}
                  onChange={(e) => setLandingPage(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="publicDrive">Public Drive URL</Label>
                <Input
                  id="publicDrive"
                  type="url"
                  value={publicDrive}
                  onChange={(e) => setPublicDrive(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories & Regions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Categories & Regions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {topCategories.length > 0 && (
              <div>
                <Label htmlFor="topcat">Primary Category *</Label>
                <Select
                  id="topcat"
                  value={topcat}
                  onChange={(e) => setTopcat(e.target.value)}
                  className="mt-1"
                >
                  <option value="">Select primary category...</option>
                  {topCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div>
              <Label>Target Regions (max 5)</Label>
              <MultiSelect
                options={regionOptions}
                selected={regionIds}
                onChange={(selected) => setRegionIds(selected)}
                placeholder="Search and select regions..."
                maxItems={5}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
          <Link href={backHref}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </>
  )
}
