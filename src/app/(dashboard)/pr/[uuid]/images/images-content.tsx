'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageCropper } from '@/components/image-cropper'
import { WizardActions } from '@/components/pr-wizard/wizard-actions'
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

interface ImagesContentProps {
  releaseUuid: string
  releaseImages: ReleaseImageRecord[]
  imageLibrary: ImageRecord[]
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
    <div className="space-y-3 p-3 border rounded-lg bg-white">
      <div>
        <Label htmlFor={`edit-title-${image.id}`}>Alt Description *</Label>
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
      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <div className="relative aspect-video bg-gray-50">
          <Image
            src={resizedUrl(ri.image.url)}
            alt={ri.image.title || 'Release image'}
            fill
            className="object-cover"
          />

          {isFirst && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
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
              className="h-7 w-7 bg-white/90 hover:bg-white"
              onClick={() => onEdit(ri.imageId)}
              title="Edit details"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-white/90 hover:bg-white text-red-600 hover:text-red-700"
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
              className="absolute bottom-8 left-2 cursor-grab active:cursor-grabbing bg-white/90 rounded p-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-gray-500" />
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
}: ImagesContentProps) {
  const router = useRouter()

  // News Images state
  const newsImageFileInputRef = useRef<HTMLInputElement>(null)
  const [releaseImages, setReleaseImages] = useState<ReleaseImageRecord[]>(initialImages)
  const [showImageLibrary, setShowImageLibrary] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newCredits, setNewCredits] = useState('')

  // Social Banner state
  const bannerFileInputRef = useRef<HTMLInputElement>(null)
  const [currentBanner, setCurrentBanner] = useState<BannerRecord | null>(banner)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [showBannerLibrary, setShowBannerLibrary] = useState(false)
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
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''

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
  }

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

  // Social Banner handlers
  const handleBannerFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
      setShowBannerLibrary(false)
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

      <Tabs defaultValue="social-banner" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="social-banner" className="flex-1">
            <Share2 className="h-4 w-4 mr-2" />
            Social Banner
            <span className="text-red-500 ml-0.5">*</span>
          </TabsTrigger>
          <TabsTrigger value="news-images" className="flex-1">
            <ImageIcon className="h-4 w-4 mr-2" />
            News Images
            <span className="text-gray-400 ml-1 text-xs">(Optional)</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news-images" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">News Images</CardTitle>
                  <CardDescription className="inline-flex items-center flex-wrap gap-x-1">
                    Add images for your press release. The first image is the primary image. You can drag images using the grip icon <GripVertical className="h-4 w-4 inline-block align-text-bottom" /> in the lower left of each image to reorder your images.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {availableLibraryImages.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImageLibrary(!showImageLibrary)}
                    >
                      <Library className="h-4 w-4" />
                      {showImageLibrary ? 'Hide Library' : 'Image Library'}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-5"
                    onClick={() => newsImageFileInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload Image
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {imageError && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {imageError}
                </div>
              )}

              {pendingFile && (
                <div className="border rounded-lg p-4 bg-blue-50 space-y-3">
                  {pendingPreview && (
                    <div className="relative w-full max-w-xs aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={pendingPreview}
                        alt="Selected image preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h4 className="text-sm font-medium text-gray-900">Image Details</h4>
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

              {showImageLibrary && availableLibraryImages.length > 0 && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Select from your library</h4>
                  <div className="grid grid-cols-4 gap-3">
                    {availableLibraryImages.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleSelectFromImageLibrary(img)}
                        disabled={isUploadingImage}
                        className="relative aspect-video rounded-lg overflow-hidden border-2 border-transparent hover:border-gray-300 transition-colors"
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
                </div>
              )}

              {releaseImages.length > 0 ? (
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
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-12 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => newsImageFileInputRef.current?.click()}
                >
                  <ImageIcon className="h-12 w-12 mb-3" />
                  <p className="text-sm font-medium text-gray-500">No images added yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Click to upload or use the Image Library button above
                  </p>
                </div>
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
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  {bannerError}
                </div>
              )}

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
                      {isLoadingBanner && (
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
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isLoadingBanner}
                  >
                    <Upload className="h-4 w-4" />
                    {displayBanner ? 'Replace Banner' : 'Upload Banner'}
                  </Button>
                  {availableLibraryBanners.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBannerLibrary(!showBannerLibrary)}
                      disabled={isLoadingBanner}
                    >
                      <Library className="h-4 w-4" />
                      {showBannerLibrary ? 'Hide Library' : 'Banner Library'}
                    </Button>
                  )}
                  {bannerPreview && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRecrop}
                      disabled={isLoadingBanner}
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
                      disabled={isLoadingBanner}
                    >
                      <X className="h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>

                {showBannerLibrary && availableLibraryBanners.length > 0 && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Select from your banner library</h4>
                    <div className="grid grid-cols-3 gap-3">
                      {availableLibraryBanners.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectFromBannerLibrary(b)}
                          disabled={isLoadingBanner}
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

              {displayBanner && (
                <div className="space-y-4 pt-4 border-t">
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

      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={3}
        isLoading={isLoadingBanner}
        onSubmit={handleContinue}
        canProceed={!!displayBanner}
      />
    </div>
  )
}
