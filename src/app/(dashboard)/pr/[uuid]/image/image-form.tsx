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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface ImageFormProps {
  releaseUuid: string
  releaseImages: ReleaseImageRecord[]
  imageLibrary: ImageRecord[]
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
        {/* Image thumbnail */}
        <div className="relative aspect-video bg-gray-50">
          <Image
            src={resizedUrl(ri.image.url)}
            alt={ri.image.title || 'Release image'}
            fill
            className="object-cover"
          />

          {/* Primary badge */}
          {isFirst && (
            <div className="absolute top-2 left-2">
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5 rounded-full">
                <Star className="h-3 w-3" />
                Primary
              </span>
            </div>
          )}

          {/* Action buttons overlay */}
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

          {/* Drag handle */}
          {canDrag && (
            <div
              className="absolute bottom-2 left-2 cursor-grab active:cursor-grabbing bg-white/90 rounded p-1"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-gray-500" />
            </div>
          )}
        </div>

        {/* Metadata below thumbnail */}
        <div className="p-2">
          {editingId === ri.imageId ? (
            <EditMetadataDialog
              image={ri.image}
              onSave={(title, imgCredits) => onSaveEdit(ri.imageId, title, imgCredits)}
              onCancel={onCancelEdit}
            />
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 truncate">
                {ri.image.title || <span className="text-gray-400 italic">No description</span>}
              </p>
              {ri.image.imgCredits && (
                <p className="text-xs text-gray-500 truncate">{ri.image.imgCredits}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function ImageForm({ releaseUuid, releaseImages: initialImages, imageLibrary }: ImageFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [releaseImages, setReleaseImages] = useState<ReleaseImageRecord[]>(initialImages)
  const [showLibrary, setShowLibrary] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Metadata prompt state for new uploads
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newCredits, setNewCredits] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // IDs already attached to this release
  const attachedImageIds = new Set(releaseImages.map((ri) => ri.imageId))

  // Library images not already attached
  const availableLibraryImages = imageLibrary.filter((img) => !attachedImageIds.has(img.id))

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-selected
    e.target.value = ''

    // Validate file size (<5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB')
      return
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are supported')
      return
    }

    setError(null)
    setPendingFile(file)
    setPendingPreview(URL.createObjectURL(file))
    setNewTitle('')
    setNewCredits('')
  }

  const handleMetadataSubmit = async () => {
    if (!pendingFile) return
    if (!newTitle.trim()) {
      setError('Alt description is required')
      return
    }

    setIsUploading(true)
    setError(null)

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
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleMetadataCancel = () => {
    setPendingFile(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    setNewTitle('')
    setNewCredits('')
  }

  const handleSelectFromLibrary = async (image: ImageRecord) => {
    setIsUploading(true)
    setError(null)

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
      setError(err instanceof Error ? err.message : 'Failed to add image')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (imageId: number) => {
    setDeletingId(imageId)
    setError(null)

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
      setError(err instanceof Error ? err.message : 'Failed to remove image')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveEdit = async (imageId: number, title: string, imgCredits: string) => {
    setError(null)

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
      setError(err instanceof Error ? err.message : 'Failed to update image')
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const oldIndex = releaseImages.findIndex((ri) => ri.imageId === active.id)
    const newIndex = releaseImages.findIndex((ri) => ri.imageId === over.id)

    const reordered = arrayMove(releaseImages, oldIndex, newIndex)
    setReleaseImages(reordered)

    // Persist reorder
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
        setError(data.error || 'Failed to reorder')
      }
    } catch {
      setReleaseImages(releaseImages)
      setError('Failed to reorder images')
    }
  }

  const handleContinue = () => {
    router.push(`/pr/${releaseUuid}/social`)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">News Images</CardTitle>
              <CardDescription>
                Add images for your press release. The first image is the primary image. You can drag images using the grip icon in the lower left of each image to reorder your images.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {availableLibraryImages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLibrary(!showLibrary)}
                >
                  <Library className="h-4 w-4" />
                  {showLibrary ? 'Hide Library' : 'Image Library'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="ml-5"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Metadata prompt for new upload */}
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
                  disabled={!newTitle.trim() || isUploading}
                >
                  {isUploading ? (
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

          {/* Image Library Selector */}
          {showLibrary && availableLibraryImages.length > 0 && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Select from your library</h4>
              <div className="grid grid-cols-4 gap-3">
                {availableLibraryImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSelectFromLibrary(img)}
                    disabled={isUploading}
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

          {/* Image Grid with drag-and-drop */}
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
                      onDelete={handleDelete}
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
              onClick={() => fileInputRef.current?.click()}
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

      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={3}
        onSubmit={handleContinue}
        canProceed={true}
        showSkip={releaseImages.length === 0}
      />
    </div>
  )
}
