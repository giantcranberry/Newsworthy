'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Upload,
  Loader2,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Newspaper,
  Share2,
  Eye,
  Search,
} from 'lucide-react'

interface UnsplashPhoto {
  id: string
  urls: { small: string; regular: string }
  alt_description: string | null
  user: { name: string; links: { html: string } }
  width: number
  height: number
}

interface ImageAsset {
  id: number
  uuid: string
  url: string
  title: string | null
  imgCredits: string | null
  width: number | null
  height: number | null
  filesize: number | null
  source: string | null
  sourceLink: string | null
}

interface AssetsFormProps {
  companyUuid: string
  images: ImageAsset[]
  totalImages: number
  currentPage: number
  totalPages: number
  filter: string
  counts: { news: number; social: number }
}

function resizedUrl(url: string, width: number = 300) {
  if (url.startsWith('https://cdn.filestackcontent.com') && url.includes('RESIZE')) {
    return url.replace('RESIZE', `resize=width:${width}`)
  }
  return url
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toTitleCase(str: string): string {
  return str.replace(
    /\b\w+/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  )
}

function ImageCredits({ image }: { image: ImageAsset }) {
  if (image.source === 'unsplash' && image.sourceLink && image.imgCredits) {
    // Extract photographer name from "Photo by {Name} on Unsplash"
    const match = image.imgCredits.match(/^Photo by (.+) on Unsplash$/)
    if (match) {
      const name = match[1]
      return (
        <p className="text-xs text-gray-400 truncate">
          Photo by{' '}
          <a
            href={image.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            {name}
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com?utm_source=newsworthy&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            Unsplash
          </a>
        </p>
      )
    }
  }

  if (!image.imgCredits) return null
  return <p className="text-xs text-gray-400 truncate">{image.imgCredits}</p>
}

export function AssetsForm({
  companyUuid,
  images,
  totalImages,
  currentPage,
  totalPages,
  filter,
  counts,
}: AssetsFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Upload state
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCredits, setUploadCredits] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCredits, setEditCredits] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // View state
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewImage, setViewImage] = useState<ImageAsset | null>(null)

  // Unsplash state
  const [unsplashQuery, setUnsplashQuery] = useState('')
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([])
  const [unsplashPage, setUnsplashPage] = useState(1)
  const [unsplashTotalPages, setUnsplashTotalPages] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<UnsplashPhoto | null>(null)
  const [unsplashError, setUnsplashError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteImage, setDeleteImage] = useState<ImageAsset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.')
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPEG, PNG, or WebP.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setPendingPreview(reader.result as string)
      setPendingFile(file)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCancelUpload = () => {
    setPendingFile(null)
    setPendingPreview(null)
    setUploadTitle('')
    setUploadCredits('')
  }

  const searchUnsplash = useCallback(async (query: string, page: number = 1) => {
    if (!query.trim()) {
      setUnsplashResults([])
      setUnsplashTotalPages(0)
      return
    }

    setIsSearching(true)
    setUnsplashError(null)

    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(query)}&page=${page}`)
      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()
      if (page === 1) {
        setUnsplashResults(data.results)
      } else {
        setUnsplashResults(prev => [...prev, ...data.results])
      }
      setUnsplashTotalPages(data.total_pages)
      setUnsplashPage(page)
    } catch {
      setUnsplashError('Failed to search Unsplash. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleUnsplashQueryChange = (value: string) => {
    setUnsplashQuery(value)
    setSelectedPhoto(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchUnsplash(value, 1)
    }, 500)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleSelectPhoto = (photo: UnsplashPhoto) => {
    setSelectedPhoto(photo)
    setUploadTitle(photo.alt_description ? toTitleCase(photo.alt_description) : '')
    setUploadCredits(`Photo by ${photo.user.name} on Unsplash`)
  }

  const handleUnsplashUpload = async () => {
    if (!selectedPhoto) return

    if (!uploadTitle.trim()) {
      setError('Alt description is required')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('unsplashUrl', selectedPhoto.urls.regular)
      formData.append('unsplashPhotoId', selectedPhoto.id)
      formData.append('unsplashPageUrl', `${selectedPhoto.user.links.html}?utm_source=newsworthy&utm_medium=referral`)
      formData.append('title', uploadTitle.trim())
      formData.append('filter', filter)
      if (uploadCredits.trim()) {
        formData.append('imgCredits', uploadCredits.trim())
      }

      const response = await fetch(`/api/company/${companyUuid}/assets`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      setSuccess('Image added from Unsplash successfully.')
      setSelectedPhoto(null)
      setUploadTitle('')
      setUploadCredits('')
      setUnsplashQuery('')
      setUnsplashResults([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleUpload = async () => {
    if (!pendingFile) return

    if (!uploadTitle.trim()) {
      setError('Alt description is required')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('title', uploadTitle.trim())
      formData.append('filter', filter)
      if (uploadCredits.trim()) {
        formData.append('imgCredits', uploadCredits.trim())
      }

      const response = await fetch(`/api/company/${companyUuid}/assets`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload image')
      }

      setSuccess('Image uploaded successfully.')
      handleCancelUpload()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const openEdit = (img: ImageAsset) => {
    setEditId(img.id)
    setEditTitle(img.title || '')
    setEditCredits(img.imgCredits || '')
    setEditError(null)
    setShowEditModal(true)
  }

  const handleEditSave = async () => {
    if (!editTitle.trim()) {
      setEditError('Alt description is required')
      return
    }

    setIsSavingEdit(true)
    setEditError(null)

    try {
      const response = await fetch(`/api/company/${companyUuid}/assets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: editId,
          title: editTitle,
          imgCredits: editCredits,
          filter,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update image')
      }

      setShowEditModal(false)
      setSuccess('Image updated successfully.')
      router.refresh()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const openDelete = (img: ImageAsset) => {
    setDeleteImage(img)
    setShowDeleteModal(true)
  }

  const handleDelete = async () => {
    if (!deleteImage) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/company/${companyUuid}/assets`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId: deleteImage.id, filter }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete image')
      }

      setShowDeleteModal(false)
      setDeleteImage(null)
      setSuccess('Image deleted.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      {/* Filter Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link href={`/company/${companyUuid}/assets?filter=news`}>
          <Card className={`cursor-pointer transition-colors ${filter === 'news' ? 'ring-2 ring-blue-500' : 'hover:bg-gray-50'}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <Newspaper className="h-5 w-5 text-blue-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{counts.news}</p>
              <p className="text-xs text-gray-500">News Images</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/company/${companyUuid}/assets?filter=social`}>
          <Card className={`cursor-pointer transition-colors ${filter === 'social' ? 'ring-2 ring-purple-500' : 'hover:bg-gray-50'}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <Share2 className="h-5 w-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900">{counts.social}</p>
              <p className="text-xs text-gray-500">Social Images</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader className="bg-blue-50 border-b rounded-t-lg">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            Upload Image
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <p className="text-sm text-gray-500">
            Upload images to your media asset library. These images can be attached to press releases.
            JPEG, PNG, or WebP up to 5MB. Images are automatically optimized.
          </p>

          <Tabs defaultValue="upload" onValueChange={() => { handleCancelUpload(); setSelectedPhoto(null); setUnsplashQuery(''); setUnsplashResults([]); setUnsplashError(null) }}>
            <TabsList>
              <TabsTrigger value="upload">
                <Upload className="h-3.5 w-3.5" />
                Upload File
              </TabsTrigger>
              <TabsTrigger value="unsplash">
                <Search className="h-3.5 w-3.5" />
                Search Unsplash
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {pendingFile && pendingPreview ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-40 h-28 relative rounded-lg overflow-hidden border bg-gray-50 shrink-0">
                      <Image
                        src={pendingPreview}
                        alt="Preview"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label htmlFor="upload-title">Alt Description *</Label>
                        <Input
                          id="upload-title"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder="Describe this image..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="upload-credits">Image Credits</Label>
                        <Input
                          id="upload-credits"
                          value={uploadCredits}
                          onChange={(e) => setUploadCredits(e.target.value)}
                          placeholder="e.g. Photo by Jane Doe"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={handleCancelUpload} disabled={isUploading}>
                      Cancel
                    </Button>
                    <Button onClick={handleUpload} disabled={isUploading || !uploadTitle.trim()}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload Image
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4" />
                  Choose File
                </Button>
              )}
            </TabsContent>

            <TabsContent value="unsplash" className="mt-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={unsplashQuery}
                  onChange={(e) => handleUnsplashQueryChange(e.target.value)}
                  placeholder="Search free photos..."
                  className="pl-9"
                />
              </div>

              {unsplashError && (
                <p className="text-sm text-red-600">{unsplashError}</p>
              )}

              {selectedPhoto ? (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-40 h-28 relative rounded-lg overflow-hidden border bg-gray-50 shrink-0">
                      <Image
                        src={selectedPhoto.urls.small}
                        alt={selectedPhoto.alt_description || 'Unsplash photo'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <Label htmlFor="unsplash-title">Alt Description *</Label>
                        <Input
                          id="unsplash-title"
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder="Describe this image..."
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unsplash-credits">Image Credits</Label>
                        <Input
                          id="unsplash-credits"
                          value={uploadCredits}
                          onChange={(e) => setUploadCredits(e.target.value)}
                          placeholder="e.g. Photo by Jane Doe on Unsplash"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => { setSelectedPhoto(null); setUploadTitle(''); setUploadCredits('') }} disabled={isUploading}>
                      Back
                    </Button>
                    <Button onClick={handleUnsplashUpload} disabled={isUploading || !uploadTitle.trim()}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Add Image
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isSearching && unsplashResults.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : unsplashResults.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {unsplashResults.map((photo) => (
                          <button
                            key={photo.id}
                            onClick={() => handleSelectPhoto(photo)}
                            className="group relative rounded-lg overflow-hidden border bg-gray-50 hover:ring-2 hover:ring-blue-500 transition-all text-left"
                          >
                            <div className="aspect-[4/3] relative">
                              <Image
                                src={photo.urls.small}
                                alt={photo.alt_description || 'Unsplash photo'}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                                unoptimized
                              />
                            </div>
                            <div className="p-1.5">
                              <p className="text-xs text-gray-500 truncate">{photo.user.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                      {unsplashPage < unsplashTotalPages && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => searchUnsplash(unsplashQuery, unsplashPage + 1)}
                            disabled={isSearching}
                          >
                            {isSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Load More
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : unsplashQuery.trim() && !isSearching ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      No photos found. Try a different search term.
                    </p>
                  ) : !unsplashQuery.trim() ? (
                    <p className="text-sm text-gray-400 text-center py-8">
                      Search for free high-quality photos from Unsplash.
                    </p>
                  ) : null}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Image Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filter === 'social' ? 'Social Images' : 'News Images'} ({totalImages})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {images.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((img) => (
                  <div key={img.id} className="group relative border rounded-lg overflow-hidden bg-gray-50">
                    <div className="aspect-[4/3] relative">
                      <Image
                        src={resizedUrl(img.url, 300)}
                        alt={img.title || 'Image'}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={() => { setViewImage(img); setShowViewModal(true) }}
                          className="p-2 bg-white rounded-full text-gray-700 hover:text-green-600 shadow-sm"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(img)}
                          className="p-2 bg-white rounded-full text-gray-700 hover:text-blue-600 shadow-sm"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openDelete(img)}
                          className="p-2 bg-white rounded-full text-gray-700 hover:text-red-600 shadow-sm"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {img.title || 'Untitled'}
                      </p>
                      <ImageCredits image={img} />
                      {img.width && img.height && (
                        <p className="text-xs text-gray-400">
                          {img.width}x{img.height}
                          {img.filesize ? ` · ${formatFileSize(img.filesize)}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {currentPage > 1 ? (
                    <Link
                      href={`/company/${companyUuid}/assets?filter=${filter}&page=${currentPage - 1}`}
                      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </span>
                  )}

                  <span className="text-sm text-gray-500 px-2">
                    Page {currentPage} of {totalPages}
                  </span>

                  {currentPage < totalPages ? (
                    <Link
                      href={`/company/${companyUuid}/assets?filter=${filter}&page=${currentPage + 1}`}
                      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm text-gray-300">
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">
              No images yet. Upload your first image above.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>
              Update the alt description and credits for this image.
            </DialogDescription>
          </DialogHeader>

          {editError && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{editError}</div>
          )}

          <div className="grid gap-4 py-2">
            <div>
              <Label htmlFor="edit-title">Alt Description *</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-credits">Image Credits</Label>
              <Input
                id="edit-credits"
                value={editCredits}
                onChange={(e) => setEditCredits(e.target.value)}
                placeholder="e.g. Photo by Jane Doe"
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={isSavingEdit}>
              {isSavingEdit ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{viewImage?.title || 'Image'}</DialogTitle>
            {viewImage?.imgCredits && (
              <DialogDescription>
                {viewImage.source === 'unsplash' && viewImage.sourceLink ? (
                  (() => {
                    const match = viewImage.imgCredits!.match(/^Photo by (.+) on Unsplash$/)
                    if (match) {
                      return (
                        <>
                          Photo by{' '}
                          <a href={viewImage.sourceLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                            {match[1]}
                          </a>
                          {' '}on{' '}
                          <a href="https://unsplash.com?utm_source=newsworthy&utm_medium=referral" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                            Unsplash
                          </a>
                        </>
                      )
                    }
                    return viewImage.imgCredits
                  })()
                ) : (
                  viewImage.imgCredits
                )}
              </DialogDescription>
            )}
          </DialogHeader>
          {viewImage && (
            <div className="relative w-full" style={{ maxHeight: '70vh' }}>
              <img
                src={resizedUrl(viewImage.url, 1200)}
                alt={viewImage.title || 'Image'}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          )}
          {viewImage?.width && viewImage?.height && (
            <p className="text-xs text-gray-400 text-center">
              {viewImage.width}x{viewImage.height}
              {viewImage.filesize ? ` · ${formatFileSize(viewImage.filesize)}` : ''}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteImage && (
            <div className="py-2">
              <div className="w-full h-32 relative rounded-lg overflow-hidden border bg-gray-50">
                <Image
                  src={resizedUrl(deleteImage.url, 600)}
                  alt={deleteImage.title || 'Image'}
                  fill
                  className="object-contain"
                />
              </div>
              {deleteImage.title && (
                <p className="text-sm text-gray-700 mt-2">{deleteImage.title}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete Image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
