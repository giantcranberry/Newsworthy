'use client'

import { useState, useRef, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Upload,
  Loader2,
  Library,
  Link2,
  FileText,
  FileAudio,
  FileVideo,
  FileArchive,
  ExternalLink,
  Pencil,
  X,
  Search,
  Paperclip,
} from 'lucide-react'
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_ATTACHMENTS,
  MAX_FILE_SIZE_BYTES,
  fileTypeLabel,
  formatFileSize,
  getUploadRejectionReason,
  isSafePublicUrl,
} from '@/lib/file-attachments'

export interface FileRecord {
  id: number
  uuid: string
  title: string
  description?: string | null
  filename?: string | null
  url: string
  mimeType?: string | null
  filesize?: number | null
  source?: string | null
}

export interface ReleaseFileRecord {
  id: number | null
  fileId: number
  sortOrder: number
  file: FileRecord
}

interface FileAttachmentsPanelProps {
  releaseUuid: string
  releaseFiles: ReleaseFileRecord[]
  fileLibrary: FileRecord[]
}

type FileSourceTab = 'library' | 'link' | null

function FileTypeIcon({ mimeType, filename }: { mimeType?: string | null; filename?: string | null }) {
  const label = fileTypeLabel(mimeType, filename)
  if (label === 'MP3' || mimeType?.startsWith('audio/')) {
    return <FileAudio className="h-8 w-8 text-cyan-700" />
  }
  if (label === 'MP4' || mimeType?.startsWith('video/')) {
    return <FileVideo className="h-8 w-8 text-cyan-700" />
  }
  if (label === 'ZIP' || mimeType?.includes('zip')) {
    return <FileArchive className="h-8 w-8 text-cyan-700" />
  }
  if (mimeType === 'text/uri-list') {
    return <ExternalLink className="h-8 w-8 text-cyan-700" />
  }
  return <FileText className="h-8 w-8 text-cyan-700" />
}

async function uploadWithProgress(
  uploadUrl: string,
  file: File,
  mimeType: string,
  onProgress: (pct: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', mimeType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status}${xhr.statusText ? ` ${xhr.statusText}` : ''})`))
    }
    xhr.onerror = () =>
      reject(new Error('Upload failed — check Linode bucket CORS allows PUT from this origin'))
    xhr.send(file)
  })
}

export function FileAttachmentsPanel({
  releaseUuid,
  releaseFiles: initialFiles,
  fileLibrary: initialLibrary,
}: FileAttachmentsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [releaseFiles, setReleaseFiles] = useState<ReleaseFileRecord[]>(initialFiles)
  const [fileLibrary, setFileLibrary] = useState<FileRecord[]>(initialLibrary)
  const [error, setError] = useState<string | null>(null)
  const [sourceTab, setSourceTab] = useState<FileSourceTab>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [librarySearch, setLibrarySearch] = useState('')

  // Pending local upload metadata
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingDescription, setPendingDescription] = useState('')

  // External link form
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDescription, setLinkDescription] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const atLimit = releaseFiles.length >= MAX_FILE_ATTACHMENTS
  const attachedIds = useMemo(() => new Set(releaseFiles.map((rf) => rf.fileId)), [releaseFiles])

  const availableLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase()
    return fileLibrary.filter((f) => {
      if (attachedIds.has(f.id)) return false
      if (!q) return true
      return (
        f.title.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q) ||
        (f.filename || '').toLowerCase().includes(q)
      )
    })
  }, [fileLibrary, attachedIds, librarySearch])

  function acceptPendingFile(file: File) {
    setError(null)
    if (atLimit) {
      setError('Maximum of 3 files per press release')
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File must be 150MB or smaller')
      return
    }
    const rejectReason = getUploadRejectionReason(file.name, file.type)
    if (rejectReason) {
      setError(rejectReason)
      return
    }
    setPendingFile(file)
    setPendingTitle(file.name.replace(/\.[^.]+$/, '').slice(0, 64))
    setPendingDescription('')
    setSourceTab(null)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) acceptPendingFile(file)
  }

  async function handleUploadSubmit() {
    if (!pendingFile || !pendingTitle.trim()) return
    setIsBusy(true)
    setError(null)
    setUploadProgress(0)
    try {
      const presignRes = await fetch(`/api/pr/${releaseUuid}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'presign',
          filename: pendingFile.name,
          mimeType: pendingFile.type,
          filesize: pendingFile.size,
          title: pendingTitle.trim(),
          description: pendingDescription.trim() || null,
        }),
      })
      const presign = await presignRes.json()
      if (!presignRes.ok) throw new Error(presign.error || 'Failed to start upload')

      await uploadWithProgress(presign.uploadUrl, pendingFile, presign.mimeType, setUploadProgress)

      const confirmRes = await fetch(`/api/pr/${releaseUuid}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          key: presign.key,
          publicUrl: presign.publicUrl,
          filename: pendingFile.name,
          mimeType: presign.mimeType,
          filesize: pendingFile.size,
          title: pendingTitle.trim(),
          description: pendingDescription.trim() || null,
        }),
      })
      const confirm = await confirmRes.json()
      if (!confirmRes.ok) throw new Error(confirm.error || 'Failed to save file')

      setReleaseFiles((prev) => [...prev, confirm.releaseFile])
      setFileLibrary((prev) => [confirm.releaseFile.file, ...prev])
      setPendingFile(null)
      setPendingTitle('')
      setPendingDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsBusy(false)
      setUploadProgress(null)
    }
  }

  async function handleAttachFromLibrary(file: FileRecord) {
    if (atLimit) {
      setError('Maximum of 3 files per press release')
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'attach', fileId: file.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to attach file')
      setReleaseFiles((prev) => [...prev, data.releaseFile])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach file')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleLinkSubmit() {
    if (!linkTitle.trim() || !linkUrl.trim()) return
    if (!isSafePublicUrl(linkUrl.trim())) {
      setError('Enter a valid http(s) URL')
      return
    }
    if (atLimit) {
      setError('Maximum of 3 files per press release')
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'link',
          url: linkUrl.trim(),
          title: linkTitle.trim(),
          description: linkDescription.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to attach link')
      setReleaseFiles((prev) => [...prev, data.releaseFile])
      setFileLibrary((prev) => [data.releaseFile.file, ...prev])
      setLinkUrl('')
      setLinkTitle('')
      setLinkDescription('')
      setSourceTab(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach link')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDetach(fileId: number) {
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/files?fileId=${fileId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove file')
      setReleaseFiles((prev) => prev.filter((rf) => rf.fileId !== fileId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove file')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSaveEdit(fileId: number) {
    if (!editTitle.trim()) return
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/pr/${releaseUuid}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          title: editTitle.trim(),
          description: editDescription.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update file')
      setReleaseFiles((prev) =>
        prev.map((rf) => (rf.fileId === fileId ? data.releaseFile : rf))
      )
      setFileLibrary((prev) =>
        prev.map((f) => (f.id === fileId ? data.releaseFile.file : f))
      )
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file')
    } finally {
      setIsBusy(false)
    }
  }

  const acceptAttr = ALLOWED_FILE_EXTENSIONS.map((e) => `.${e}`).join(',')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Paperclip className="h-4 w-4" />
          File Attachments
        </CardTitle>
        <CardDescription>
          Attach up to {MAX_FILE_ATTACHMENTS} files (PDF, PPT, DOC, XLS, EPUB, MP3, MP4 — max 150MB each),
          or link to a public share URL. Files are saved to your brand library. Executables, scripts,
          HTML/JavaScript, and archives are not allowed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
            {error}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptAttr}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Pending upload metadata */}
        {pendingFile && (
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {pendingFile.name}{' '}
              <span className="text-gray-500 font-normal">({formatFileSize(pendingFile.size)})</span>
            </p>
            <div>
              <Label htmlFor="file-title">Name *</Label>
              <Input
                id="file-title"
                value={pendingTitle}
                onChange={(e) => setPendingTitle(e.target.value)}
                className="mt-1"
                maxLength={64}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="file-desc">Description</Label>
              <Input
                id="file-desc"
                value={pendingDescription}
                onChange={(e) => setPendingDescription(e.target.value)}
                className="mt-1"
                placeholder="Optional short description"
              />
            </div>
            {uploadProgress !== null && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full bg-cyan-700 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isBusy}
                onClick={() => {
                  setPendingFile(null)
                  setPendingTitle('')
                  setPendingDescription('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUploadSubmit}
                disabled={!pendingTitle.trim() || isBusy}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload & Attach'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Dropzone */}
        {!pendingFile && !atLimit && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) acceptPendingFile(file)
            }}
            className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-cyan-700 bg-cyan-50 dark:bg-cyan-900/30'
                : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 hover:border-cyan-700'
            }`}
          >
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3 mb-3">
              <Upload className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Drop a file here, or <span className="text-cyan-700">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, PPT, DOC, XLS, EPUB, MP3, MP4 up to 150MB
            </p>
          </div>
        )}

        {atLimit && !pendingFile && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            Maximum of {MAX_FILE_ATTACHMENTS} files attached.
          </p>
        )}

        {/* Source toggles */}
        {!pendingFile && !atLimit && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={sourceTab === 'library' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceTab(sourceTab === 'library' ? null : 'library')}
              className={sourceTab === 'library' ? 'bg-cyan-700 hover:bg-cyan-800' : ''}
            >
              <Library className="h-4 w-4" />
              Select from Brand Assets
            </Button>
            <Button
              type="button"
              variant={sourceTab === 'link' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSourceTab(sourceTab === 'link' ? null : 'link')}
              className={sourceTab === 'link' ? 'bg-cyan-700 hover:bg-cyan-800' : ''}
            >
              <Link2 className="h-4 w-4" />
              Attach public URL
            </Button>
          </div>
        )}

        {/* Brand library */}
        {sourceTab === 'library' && !pendingFile && (
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-950 space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1">
                Select from your brand files
              </h4>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Search files..."
                  className="pl-8 h-8"
                />
              </div>
            </div>
            {availableLibrary.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableLibrary.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
                  >
                    <FileTypeIcon mimeType={f.mimeType} filename={f.filename} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {f.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {fileTypeLabel(f.mimeType, f.filename)}
                        {f.filesize ? ` · ${formatFileSize(f.filesize)}` : ''}
                        {f.source === 'external' ? ' · Link' : ''}
                      </p>
                      {f.description && (
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{f.description}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy || atLimit}
                      onClick={() => handleAttachFromLibrary(f)}
                      className="shrink-0"
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">
                {librarySearch
                  ? 'No brand files match your search.'
                  : 'No unused files in your brand library.'}
              </p>
            )}
          </div>
        )}

        {/* Public URL form */}
        {sourceTab === 'link' && !pendingFile && (
          <div className="border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-950 space-y-3">
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-300 space-y-1">
              <p className="font-medium">How to attach a Google Drive / Docs / Slides link</p>
              <ol className="list-decimal list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
                <li>Open the file → Share</li>
                <li>Set access to Anyone with the link → Viewer</li>
                <li>Copy link and paste below</li>
              </ol>
              <p className="text-blue-600 dark:text-blue-400">
                Prefer a direct file link when available. Some viewers may require visitors to sign in.
              </p>
            </div>
            <div>
              <Label htmlFor="link-url">Public URL *</Label>
              <Input
                id="link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="link-title">Name *</Label>
              <Input
                id="link-title"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="e.g., Product Overview Deck"
                className="mt-1"
                maxLength={64}
              />
            </div>
            <div>
              <Label htmlFor="link-desc">Description</Label>
              <Input
                id="link-desc"
                value={linkDescription}
                onChange={(e) => setLinkDescription(e.target.value)}
                className="mt-1"
                placeholder="Optional short description"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleLinkSubmit}
                disabled={!linkUrl.trim() || !linkTitle.trim() || isBusy}
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Attach Link'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Attached files listing */}
        {releaseFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Attached ({releaseFiles.length}/{MAX_FILE_ATTACHMENTS})
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              You should be cautious when downloading files online. Take normal precautions.
            </p>
            <ul className="space-y-3">
              {releaseFiles.map((rf) => {
                const f = rf.file
                const isEditing = editingId === f.id
                const canPreviewAudio = f.mimeType?.startsWith('audio/')
                const canPreviewVideo = f.mimeType?.startsWith('video/')

                return (
                  <li
                    key={rf.fileId}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 mt-0.5">
                        <FileTypeIcon mimeType={f.mimeType} filename={f.filename} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        {isEditing ? (
                          <>
                            <Input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              maxLength={64}
                              className="h-8"
                            />
                            <Input
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Description"
                              className="h-8"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveEdit(f.id)}
                                disabled={isBusy || !editTitle.trim()}
                              >
                                Save
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {f.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  <span className="inline-flex items-center rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 font-medium mr-1.5">
                                    {f.source === 'external'
                                      ? 'LINK'
                                      : fileTypeLabel(f.mimeType, f.filename)}
                                  </span>
                                  {f.filesize ? formatFileSize(f.filesize) : null}
                                </p>
                                {f.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                    {f.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingId(f.id)
                                    setEditTitle(f.title)
                                    setEditDescription(f.description || '')
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600"
                                  disabled={isBusy}
                                  onClick={() => handleDetach(f.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {canPreviewAudio && (
                              <audio controls preload="metadata" src={f.url} className="w-full mt-1" />
                            )}
                            {canPreviewVideo && (
                              <video
                                controls
                                preload="metadata"
                                src={f.url}
                                className="w-full max-h-48 rounded mt-1 bg-black"
                              />
                            )}
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              {f.source === 'external' ? 'Open link' : 'Open / download'}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
