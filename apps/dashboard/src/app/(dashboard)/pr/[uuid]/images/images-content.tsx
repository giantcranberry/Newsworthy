'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageCropper } from '@/components/image-cropper'
import { WizardHeader } from '@/components/pr-wizard/wizard-header'
import {
  ImageIcon,
  X,
  Library,
  GripVertical,
  Upload,
  Loader2,
  Star,
  Pencil,
  Share2,
  Check,
  Info,
  Crop,
  Search,
} from 'lucide-react'

interface ImageRecord {
  id: number
  uuid: string
  url: string
  title?: string | null
  caption?: string | null
  imgCredits?: string | null
  width?: number | null
  height?: number | null
}

interface ReleaseImageRecord {
  id: number
  imageId: number
  sortOrder: number
  image: ImageRecord
}

interface BannerRecord {
  id: number
  uuid: string
  url: string
  title?: string | null
  imgCredits?: string | null
  width?: number | null
  height?: number | null
}

interface UnsplashPhoto {
  id: string
  urls: { small: string; regular: string }
  alt_description: string | null
  user: { name: string; links: { html: string } }
  width: number
  height: number
}

type ImageSourceTab = 'unsplash' | 'library' | null

interface ImagesContentProps {
  releaseUuid: string
  releaseImages: ReleaseImageRecord[]
  imageLibrary: ImageRecord[]
  banner: BannerRecord | null
  releaseTitle: string
  bannerLibrary: BannerRecord[]
  children?: React.ReactNode
}

function resizedUrl(url: string) {
  if (url.includes('RESIZE')) {
    return url.replace('RESIZE', 'resize=width:300')
  }
  return url
}

function EditMetadataDialog({
  image,
  onSave,
  onCancel,
}: {
  image: ImageRecord
  onSave: (title: string, imgCredits: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(image.title || '')
  const [imgCredits, setImgCredits] = useState(image.imgCredits || '')

  return (
    <div className="space-y-3 p-3 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      <div>
        <Label htmlFor={`edit-title-${image.id}`}>Description / Caption *</Label>
        <Input
          id={`edit-title-${image.id}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Describe the image for accessibility"
          className="mt-1"
          maxLength={255}
        />
      </div>
      <div>
        <Label htmlFor={`edit-credits-${image.id}`}>Photo Credits</Label>
        <Input
          id={`edit-credits-${image.id}`}
          value={imgCredits}
          onChange={(e) => setImgCredits(e.target.value)}
          placeholder="e.g., Photo by Jane Smith"
          className="mt-1"
          maxLength={128}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(title, imgCredits)}
          disabled={!title.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

function SortableImageCard({
  ri,
  isFirst,
  canDrag,
  onDelete,
  onEdit,
  editingId,
  onSaveEdit,
  onCancelEdit,
  isDeleting,
}: {
  ri: ReleaseImageRecord
  isFirst: boolean
  canDrag: boolean
  onDelete: (imageId: number) => void
  onEdit: (imageId: number) => void
  editingId: number | null
  onSaveEdit: (imageId: number, title: string, imgCredits: string) => void
  onCancelEdit: () => void
  isDeleting: number | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ri.imageId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="border dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm dark:shadow-gray-900/50">
        <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
          <Image
            src={resizedUrl(ri.image.url)}
            alt={ri.image.title || 'Release image'}
            fill
            className="object-contain"
          />

          {isFirst && (
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
              onClick={() => onEdit(ri.imageId)}
              title="Edit details"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-white dark:bg-gray-900/90 hover:bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 hover:text-red-700 dark:text-red-400"
              onClick={() => onDelete(ri.imageId)}
              disabled={isDeleting === ri.imageId}
              title="Remove image"
            >
              {isDeleting === ri.imageId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {canDrag && (
            <div
              className="absolute bottom-8 left-2 cursor-grab active:cursor-grabbing bg-white dark:bg-gray-900/90 rounded p-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
          )}

          {/* Alt Description overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1.5">
            <p className="text-xs text-white truncate">
              {ri.image.title || <span className="italic opacity-70">No alt description</span>}
            </p>
          </div>
        </div>

        {editingId === ri.imageId && (
          <div className="p-2">
            <EditMetadataDialog
              image={ri.image}
              onSave={(title, imgCredits) => onSaveEdit(ri.imageId, title, imgCredits)}
              onCancel={onCancelEdit}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export function ImagesContent({
  releaseUuid,
  releaseImages: initialImages,
  imageLibrary,
  banner,
  releaseTitle,
  bannerLibrary,
  children,
}: ImagesContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // News Images state
  const newsImageFileInputRef = useRef<HTMLInputElement>(null)
  const [releaseImages, setReleaseImages] = useState<ReleaseImageRecord[]>(initialImages)
  // showImageLibrary replaced by newsSource === 'library'
  const [imageError, setImageError] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newCredits, setNewCredits] = useState('')

  // Tab state
  const [activeTab, setActiveTabRaw] = useState('social-banner')
  const setActiveTab = (tab: string) => {
    setActiveTabRaw(tab)
    if (tab === 'news-images') {
      sessionStorage.setItem(`images-visited-news-${releaseUuid}`, '1')
    }
  }

  // Auto-switch to news-images tab if redirected from share page
  useEffect(() => {
    if (searchParams.get('tab') === 'news-images') {
      setActiveTab('news-images')
    }
  }, [searchParams])

  // Source selector state (null = default dropzone visible)
  const [newsSource, setNewsSource] = useState<ImageSourceTab>(null)
  const [bannerSource, setBannerSource] = useState<ImageSourceTab>(null)

  // Unsplash state - news images
  const [newsUnsplashQuery, setNewsUnsplashQuery] = useState('')
  const [newsUnsplashResults, setNewsUnsplashResults] = useState<UnsplashPhoto[]>([])
  const [newsUnsplashLoading, setNewsUnsplashLoading] = useState(false)

  // Unsplash state - banner
  const [bannerUnsplashQuery, setBannerUnsplashQuery] = useState('')
  const [bannerUnsplashResults, setBannerUnsplashResults] = useState<UnsplashPhoto[]>([])
  const [bannerUnsplashLoading, setBannerUnsplashLoading] = useState(false)

  // Dropzone state
  const [isDragOverImage, setIsDragOverImage] = useState(false)
  const [isDragOverBanner, setIsDragOverBanner] = useState(false)

  // Social Banner state
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const [currentBanner, setCurrentBanner] = useState<BannerRecord | null>(banner)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  // showBannerLibrary replaced by bannerSource === 'library'
  const [bannerFormData, setBannerFormData] = useState({
    title: banner?.title || releaseTitle || '',
    imgCredits: banner?.imgCredits || '',
  })
  const [isLoadingBanner, setIsLoadingBanner] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const attachedImageIds = new Set(releaseImages.map((ri) => ri.imageId))
  const availableLibraryImages = imageLibrary.filter((img) => !attachedImageIds.has(img.id))
  const displayBannerRaw = bannerPreview || currentBanner?.url
  const displayBanner = displayBannerRaw ? resizedUrl(displayBannerRaw) : null
  const availableLibraryBanners = bannerLibrary.filter(
    (b) => !currentBanner || b.id !== currentBanner.id
  )

  // News Images handlers
  const processImageFile = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be under 5MB')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageError('Only JPEG, PNG, and WebP images are supported')
      return
    }

    setImageError(null)
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
    setNewTitle('')
    setNewCredits('')
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    processImageFile(file)
  }

  const handleImageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImage(true)
  }, [])

  const handleImageDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImage(false)
  }, [])

  const handleImageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverImage(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processImageFile(file)
  }, [processImageFile])

  const handleMetadataSubmit = async () => {
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

      const response = await fetch(`/api/pr/${releaseUuid}/image`, {
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

  const handleMetadataCancel = () => {
    setPendingFile(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    setNewTitle('')
    setNewCredits('')
  }

  const handleSelectFromImageLibrary = async (image: ImageRecord) => {
    setIsUploadingImage(true)
    setImageError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: image.id }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add image')
      }

      const data = await response.json()
      setReleaseImages((prev) => [...prev, data.releaseImage])
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to add image')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleDeleteImage = async (imageId: number) => {
    setDeletingId(imageId)
    setImageError(null)

    try {
      const response = await fetch(
        `/api/pr/${releaseUuid}/image?imageId=${imageId}`,
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

  const handleSaveEdit = async (imageId: number, title: string, imgCredits: string) => {
    setImageError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/image`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, title, imgCredits }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update image')
      }

      setReleaseImages((prev) =>
        prev.map((ri) =>
          ri.imageId === imageId
            ? { ...ri, image: { ...ri.image, title, imgCredits } }
            : ri
        )
      )
      setEditingId(null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to update image')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = releaseImages.findIndex((ri) => ri.imageId === active.id)
    const newIndex = releaseImages.findIndex((ri) => ri.imageId === over.id)

    const reordered = arrayMove(releaseImages, oldIndex, newIndex)
    setReleaseImages(reordered)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/image`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageIds: reordered.map((ri) => ri.imageId),
        }),
      })

      if (!response.ok) {
        setReleaseImages(releaseImages)
        const data = await response.json()
        setImageError(data.error || 'Failed to reorder')
      }
    } catch {
      setReleaseImages(releaseImages)
      setImageError('Failed to reorder images')
    }
  }

  // Unsplash handlers
  const searchUnsplash = async (query: string, target: 'news' | 'banner') => {
    if (!query.trim()) return

    if (target === 'news') {
      setNewsUnsplashLoading(true)
    } else {
      setBannerUnsplashLoading(true)
    }

    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      if (target === 'news') {
        setNewsUnsplashResults(data.results || [])
      } else {
        setBannerUnsplashResults(data.results || [])
      }
    } catch {
      if (target === 'news') {
        setImageError('Failed to search Unsplash')
      } else {
        setBannerError('Failed to search Unsplash')
      }
    } finally {
      if (target === 'news') {
        setNewsUnsplashLoading(false)
      } else {
        setBannerUnsplashLoading(false)
      }
    }
  }

  const handleSelectUnsplashNews = async (photo: UnsplashPhoto) => {
    setIsUploadingImage(true)
    setImageError(null)

    try {
      // Fetch image as blob
      const res = await fetch(photo.urls.regular)
      const blob = await res.blob()
      const file = new File([blob], `unsplash-${photo.id}.jpg`, { type: 'image/jpeg' })

      // Upload via the existing FormData path
      const formData = new FormData()
      formData.append('image', file)
      formData.append('title', photo.alt_description || 'Unsplash photo')
      formData.append('imgCredits', `Photo by ${photo.user.name} on Unsplash`)

      const response = await fetch(`/api/pr/${releaseUuid}/image`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add image')
      }

      const data = await response.json()
      setReleaseImages((prev) => [...prev, data.releaseImage])
      setNewsSource(null)
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to add Unsplash image')
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleSelectUnsplashBanner = async (photo: UnsplashPhoto) => {
    setBannerError(null)

    try {
      // Fetch image as data URL for the cropper
      const res = await fetch(photo.urls.regular)
      const blob = await res.blob()

      const reader = new FileReader()
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        // Unsplash images won't be exactly 1200x630, so always open cropper
        setCropperImageSrc(dataUrl)
        setShowCropper(true)
        // Pre-fill banner credits
        setBannerFormData((prev) => ({
          ...prev,
          imgCredits: `Photo by ${photo.user.name} on Unsplash`,
        }))
        setBannerSource(null)
      }
      reader.readAsDataURL(blob)
    } catch {
      setBannerError('Failed to load Unsplash image')
    }
  }

  // Social Banner handlers
  const processBannerFile = useCallback((file: File) => {
    setBannerError(null)

    if (file.size > 10 * 1024 * 1024) {
      setBannerError('File too large. Maximum size is 10MB.')
      return
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setBannerError('Invalid file type. Please upload PNG, JPEG, or WebP.')
      return
    }

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
        }
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }, [])

  const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    processBannerFile(file)
  }

  const handleBannerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverBanner(true)
  }, [])

  const handleBannerDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverBanner(false)
  }, [])

  const handleBannerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverBanner(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processBannerFile(file)
  }, [processBannerFile])

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

  const handleSelectFromBannerLibrary = async (libraryBanner: BannerRecord) => {
    setIsLoadingBanner(true)
    setBannerError(null)

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
      setBannerFormData({
        title: libraryBanner.title || releaseTitle || '',
        imgCredits: libraryBanner.imgCredits || '',
      })
      setBannerSource(null)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Failed to select banner')
    } finally {
      setIsLoadingBanner(false)
    }
  }

  const handleContinue = async () => {
    setIsLoadingBanner(true)
    setBannerError(null)

    try {
      if (bannerFile) {
        const fd = new FormData()
        fd.append('banner', bannerFile)
        if (bannerFormData.title) fd.append('title', bannerFormData.title)
        if (bannerFormData.imgCredits) fd.append('imgCredits', bannerFormData.imgCredits)

        const response = await fetch(`/api/pr/${releaseUuid}/social`, {
          method: 'POST',
          body: fd,
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to save banner')
        }
      } else if (currentBanner && (
        bannerFormData.title !== currentBanner.title ||
        bannerFormData.imgCredits !== currentBanner.imgCredits
      )) {
        const response = await fetch(`/api/pr/${releaseUuid}/social`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: bannerFormData.title || null,
            imgCredits: bannerFormData.imgCredits || null,
          }),
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update banner')
        }
      }

      router.push(`/pr/${releaseUuid}/share`)
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoadingBanner(false)
    }
  }

  return (
    <div className="space-y-6">
      <WizardHeader
        title="Images"
        description="Add news images and social media banner for your press release"
        releaseUuid={releaseUuid}
        currentStep={4}
        isLoading={isLoadingBanner}
        onSubmit={handleContinue}
        onNext={() => {
          if (activeTab === 'social-banner') {
            setActiveTab('news-images')
            return false
          }
        }}
        canProceed={!!displayBanner}
      />

      <div className="flex items-center gap-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 px-4 py-2.5 text-sm text-cyan-800 dark:text-cyan-300">
        <span className="text-lg">🎉</span>
        <span className="font-medium">New!</span>
        <span>Now supporting multiple news images per release</span>
      </div>

      {children}
      <input
        ref={newsImageFileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={bannerFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleBannerFileSelect}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-6">
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('social-banner')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all cursor-pointer border-2 ${
              activeTab === 'social-banner'
                ? 'bg-cyan-700 text-white border-cyan-700 shadow-sm dark:shadow-gray-900/50'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-cyan-600 hover:text-cyan-700'
            }`}
          >
            <Share2 className="h-4 w-4" />
            Social Banner
            <span className={activeTab === 'social-banner' ? 'text-red-300' : 'text-red-400'}>*</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('news-images')}
            className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all cursor-pointer border-2 ${
              activeTab === 'news-images'
                ? 'bg-cyan-700 text-white border-cyan-700 shadow-sm dark:shadow-gray-900/50'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:border-cyan-600 hover:text-cyan-700'
            }`}
          >
            <ImageIcon className="h-4 w-4" />
            News Images
            <span className={`text-xs ${activeTab === 'news-images' ? 'text-gray-300' : 'text-gray-400'}`}>(Optional)</span>
          </button>
        </div>

        <TabsContent value="news-images" className="mt-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="text-base">News Images</CardTitle>
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 px-2.5 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                  Yes, Now Supporting Multiple Images
                </div>
                <CardDescription className="mt-2 inline-flex items-center flex-wrap gap-x-1">
                  Add images for your press release. The first image is the primary image. You can drag images using the grip icon <GripVertical className="h-4 w-4 inline-block align-text-bottom" aria-hidden="true" /> in the lower left of each image to reorder your images.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {imageError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">
                  {imageError}
                </div>
              )}

              {pendingFile && (
                <div className="border dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
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
                    <Label htmlFor="new-title">Description / Caption *</Label>
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
                    <Button type="button" variant="ghost" size="sm" onClick={handleMetadataCancel}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleMetadataSubmit}
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

              {/* Upload dropzone — always visible */}
              {!pendingFile && (
                <div
                  onClick={() => newsImageFileInputRef.current?.click()}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  onDrop={handleImageDrop}
                  className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragOverImage
                      ? 'border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30'
                      : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-700 hover:bg-cyan-50 dark:bg-cyan-900/30/50'
                  }`}
                >
                  <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Drop an image here, or <span className="text-cyan-700">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPEG, PNG, or WebP up to 5MB
                  </p>
                </div>
              )}

              {/* Unsplash / Brand Assets toggle */}
              {!pendingFile && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={newsSource === 'unsplash' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewsSource(newsSource === 'unsplash' ? null : 'unsplash')}
                    className={newsSource === 'unsplash' ? 'bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600' : ''}
                  >
                    <Search className="h-4 w-4" />
                    Unsplash
                  </Button>
                  <Button
                    type="button"
                    variant={newsSource === 'library' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewsSource(newsSource === 'library' ? null : 'library')}
                    className={newsSource === 'library' ? 'bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600' : ''}
                  >
                    <Library className="h-4 w-4" />
                    Select from Brand Assets
                  </Button>
                </div>
              )}

              {/* Unsplash search */}
              {newsSource === 'unsplash' && !pendingFile && (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      searchUnsplash(newsUnsplashQuery, 'news')
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={newsUnsplashQuery}
                      onChange={(e) => setNewsUnsplashQuery(e.target.value)}
                      placeholder="Search Unsplash photos..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={newsUnsplashLoading || !newsUnsplashQuery.trim()}
                    >
                      {newsUnsplashLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </form>

                  {isUploadingImage && (
                    <div className="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding image...
                    </div>
                  )}

                  {newsUnsplashResults.length > 0 && !isUploadingImage && (
                    <div className="grid grid-cols-3 gap-3">
                      {newsUnsplashResults.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => handleSelectUnsplashNews(photo)}
                          disabled={isUploadingImage}
                          className="group relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-cyan-400 transition-colors"
                        >
                          <Image
                            src={photo.urls.small}
                            alt={photo.alt_description || 'Unsplash photo'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-white truncate">
                              by {photo.user.name}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {newsUnsplashResults.length === 0 && !newsUnsplashLoading && newsUnsplashQuery && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No results. Try a different search term.
                    </p>
                  )}

                  <p className="text-xs text-gray-400">
                    Photos provided by{' '}
                    <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
                      Unsplash
                    </a>
                  </p>
                </div>
              )}

              {/* Brand asset library */}
              {newsSource === 'library' && !pendingFile && (
                <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-950">
                  {availableLibraryImages.length > 0 ? (
                    <>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select from your brand assets</h4>
                      <div className="grid grid-cols-4 gap-3">
                        {availableLibraryImages.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => handleSelectFromImageLibrary(img)}
                            disabled={isUploadingImage}
                            className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-cyan-400 transition-colors"
                          >
                            <Image
                              src={resizedUrl(img.url)}
                              alt={img.title || 'Library image'}
                              fill
                              className="object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No unused images in your brand library.
                    </p>
                  )}
                </div>
              )}

              {releaseImages.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={releaseImages.map((ri) => ri.imageId)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {releaseImages.map((ri, index) => (
                        <SortableImageCard
                          key={ri.imageId}
                          ri={ri}
                          isFirst={index === 0}
                          canDrag={releaseImages.length > 1}
                          onDelete={handleDeleteImage}
                          onEdit={setEditingId}
                          editingId={editingId}
                          onSaveEdit={handleSaveEdit}
                          onCancelEdit={() => setEditingId(null)}
                          isDeleting={deletingId}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social-banner" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Social Media Banner</CardTitle>
              <CardDescription>
                This image appears when your press release is shared on social media
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {bannerError && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">
                  {bannerError}
                </div>
              )}

              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-blue-700 dark:text-blue-400">
                  <strong>Recommended size: 1200 x 630 pixels</strong>
                  <p className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                    This is the optimal size for Twitter, Facebook, and LinkedIn previews.
                    Your image will be cropped to this aspect ratio.
                  </p>
                </div>
              </div>

              {displayBanner && (
                <div className="max-w-xl">
                <div className="relative rounded-lg overflow-hidden border dark:border-gray-700 bg-gray-50 dark:bg-gray-950" style={{ aspectRatio: '1200/630' }}>
                  <Image
                    src={displayBanner}
                    alt="Social media banner"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {bannerPreview && (
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs px-2 py-1 rounded-full">
                        <Check className="h-3 w-3" />
                        New
                      </span>
                    </div>
                  )}
                  {isLoadingBanner && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900/80">
                      <Loader2 className="h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400" />
                    </div>
                  )}
                </div>
                </div>
              )}

              {displayBanner && (
                <div className="flex items-center gap-2">
                  {bannerPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecrop()}
                      disabled={isLoadingBanner}
                    >
                      <Crop className="h-4 w-4" />
                      Re-crop
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBanner()}
                    className="text-gray-500 dark:text-gray-400"
                    disabled={isLoadingBanner}
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}

              {/* Upload dropzone — always visible */}
              <div
                onClick={() => bannerFileInputRef.current?.click()}
                onDragOver={handleBannerDragOver}
                onDragLeave={handleBannerDragLeave}
                onDrop={handleBannerDrop}
                className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                  isDragOverBanner
                    ? 'border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30'
                    : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-700 hover:bg-cyan-50 dark:bg-cyan-900/30/50'
                }`}
              >
                <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {displayBanner ? 'Drop a new banner here, or ' : 'Drop your banner here, or '}
                  <span className="text-cyan-700">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  PNG, JPEG, or WebP up to 10MB &middot; 1200 x 630px recommended
                </p>
              </div>

              {/* Unsplash / Brand Assets toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={bannerSource === 'unsplash' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBannerSource(bannerSource === 'unsplash' ? null : 'unsplash')}
                  className={bannerSource === 'unsplash' ? 'bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600' : ''}
                >
                  <Search className="h-4 w-4" />
                  Unsplash
                </Button>
                <Button
                  type="button"
                  variant={bannerSource === 'library' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBannerSource(bannerSource === 'library' ? null : 'library')}
                  className={bannerSource === 'library' ? 'bg-cyan-700 hover:bg-cyan-800 dark:bg-cyan-600' : ''}
                >
                  <Library className="h-4 w-4" />
                  Brand Assets
                </Button>
              </div>

              {/* Unsplash search */}
              {bannerSource === 'unsplash' && (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      searchUnsplash(bannerUnsplashQuery, 'banner')
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={bannerUnsplashQuery}
                      onChange={(e) => setBannerUnsplashQuery(e.target.value)}
                      placeholder="Search Unsplash photos..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={bannerUnsplashLoading || !bannerUnsplashQuery.trim()}
                    >
                      {bannerUnsplashLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </form>

                  {bannerUnsplashResults.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      {bannerUnsplashResults.map((photo) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => handleSelectUnsplashBanner(photo)}
                          className="group relative rounded-lg overflow-hidden border-2 border-transparent hover:border-cyan-400 transition-colors"
                          style={{ aspectRatio: '1200/630' }}
                        >
                          <Image
                            src={photo.urls.small}
                            alt={photo.alt_description || 'Unsplash photo'}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-xs text-white truncate">
                              by {photo.user.name}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {bannerUnsplashResults.length === 0 && !bannerUnsplashLoading && bannerUnsplashQuery && (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No results. Try a different search term.
                    </p>
                  )}

                  <p className="text-xs text-gray-400">
                    Photos provided by{' '}
                    <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="underline">
                      Unsplash
                    </a>
                    . Images will be cropped to 1200 x 630px.
                  </p>
                </div>
              )}

              {/* Brand asset library */}
              {bannerSource === 'library' && (
                <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-950">
                  {availableLibraryBanners.length > 0 ? (
                    <>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Select from your banner library</h4>
                      <div className="grid grid-cols-3 gap-3">
                        {availableLibraryBanners.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleSelectFromBannerLibrary(b)}
                            disabled={isLoadingBanner}
                            className="relative rounded-lg overflow-hidden border-2 border-transparent hover:border-cyan-400 transition-colors"
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
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">
                      No banners in your brand library.
                    </p>
                  )}
                </div>
              )}

              {displayBanner && (
                <div className="space-y-4 pt-4 border-t dark:border-gray-700">
                  <div>
                    <Label htmlFor="banner-title">Alt Text / Title</Label>
                    <Input
                      id="banner-title"
                      value={bannerFormData.title}
                      onChange={(e) => setBannerFormData({ ...bannerFormData, title: e.target.value })}
                      placeholder="Describe the image for accessibility"
                      className="mt-1"
                      maxLength={255}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Used for screen readers and when the image cannot load
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="banner-credits">Image Credits (Optional)</Label>
                    <Input
                      id="banner-credits"
                      value={bannerFormData.imgCredits}
                      onChange={(e) => setBannerFormData({ ...bannerFormData, imgCredits: e.target.value })}
                      placeholder="e.g., Photo by Jane Smith"
                      className="mt-1"
                      maxLength={128}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </div>
  )
}
