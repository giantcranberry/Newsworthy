'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Upload,
  Loader2,
  Link2,
  FileText,
  FileAudio,
  FileVideo,
  FileArchive,
  ExternalLink,
  Pencil,
  Trash2,
} from 'lucide-react'
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  fileTypeLabel,
  formatFileSize,
  getUploadRejectionReason,
  isSafePublicUrl,
} from '@/lib/file-attachments'

export interface BrandFile {
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

interface BrandFilesPanelProps {
  readOnly?: boolean
  companyUuid: string
  files: BrandFile[]
  totalFiles: number
  currentPage: number
  totalPages: number
}

function FileTypeIcon({ mimeType, filename }: { mimeType?: string | null; filename?: string | null }) {
  const label = fileTypeLabel(mimeType, filename)
  if (label === 'MP3' || mimeType?.startsWith('audio/')) {
    return <FileAudio className="h-7 w-7 text-cyan-700" />
  }
  if (label === 'MP4' || mimeType?.startsWith('video/')) {
    return <FileVideo className="h-7 w-7 text-cyan-700" />
  }
  if (label === 'ZIP' || mimeType?.includes('zip')) {
    return <FileArchive className="h-7 w-7 text-cyan-700" />
  }
  if (mimeType === 'text/uri-list') {
    return <ExternalLink className="h-7 w-7 text-cyan-700" />
  }
  return <FileText className="h-7 w-7 text-cyan-700" />
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

export function BrandFilesPanel({
  readOnly,
  companyUuid,
  files: initialFiles,
  totalFiles,
  currentPage,
  totalPages,
}: BrandFilesPanelProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState(initialFiles)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [mode, setMode] = useState<'upload' | 'link'>('upload')

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingDescription, setPendingDescription] = useState('')

  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkDescription, setLinkDescription] = useState('')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  function acceptFile(file: File) {
    setError(null)
    setSuccess(null)
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
  }

  async function handleUpload() {
    if (!pendingFile || !pendingTitle.trim()) return
    setIsBusy(true)
    setError(null)
    setUploadProgress(0)
    try {
      const presignRes = await fetch(`/api/company/${companyUuid}/files`, {
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

      const confirmRes = await fetch(`/api/company/${companyUuid}/files`, {
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

      setFiles((prev) => [confirm.file, ...prev])
      setPendingFile(null)
      setPendingTitle('')
      setPendingDescription('')
      setSuccess('File uploaded successfully.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsBusy(false)
      setUploadProgress(null)
    }
  }

  async function handleLink() {
    if (!linkTitle.trim() || !linkUrl.trim()) return
    if (!isSafePublicUrl(linkUrl.trim())) {
      setError('Enter a valid http(s) URL')
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/company/${companyUuid}/files`, {
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
      if (!res.ok) throw new Error(data.error || 'Failed to save link')
      setFiles((prev) => [data.file, ...prev])
      setLinkUrl('')
      setLinkTitle('')
      setLinkDescription('')
      setSuccess('Link saved to brand files.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleSaveEdit(fileId: number) {
    if (!editTitle.trim()) return
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/company/${companyUuid}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          title: editTitle.trim(),
          description: editDescription.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      setFiles((prev) => prev.map((f) => (f.id === fileId ? data.file : f)))
      setEditingId(null)
      setSuccess('File updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDelete(fileId: number) {
    if (!confirm('Delete this file from your brand library? It will be detached from any press releases.')) {
      return
    }
    setIsBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/company/${companyUuid}/files?fileId=${fileId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
      setSuccess('File deleted.')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setIsBusy(false)
    }
  }

  const acceptAttr = ALLOWED_FILE_EXTENSIONS.map((e) => `.${e}`).join(',')

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 p-3 rounded-lg">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-700 dark:text-green-400 bg-green-50 p-3 rounded-lg">{success}</div>
      )}

      {!readOnly && (
        <Card>
          <CardHeader className="bg-cyan-700/10 border-b rounded-t-lg">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-cyan-700" />
              Add File
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex w-full rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'upload'
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Upload className="h-4 w-4" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setMode('link')}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                  mode === 'link'
                    ? 'bg-cyan-700 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                <Link2 className="h-4 w-4" />
                Public URL
              </button>
            </div>

            {mode === 'upload' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  PDF, PPT, DOC, XLS, EPUB, MP3, MP4 up to 150MB. Executables, scripts, HTML/JavaScript, and archives are not allowed.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptAttr}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) acceptFile(file)
                  }}
                />
                {!pendingFile ? (
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4" />
                    Choose File
                  </Button>
                ) : (
                  <div className="space-y-3 border rounded-lg p-4 bg-gray-50 dark:bg-gray-950">
                    <p className="text-sm font-medium">
                      {pendingFile.name}{' '}
                      <span className="text-gray-500 font-normal">({formatFileSize(pendingFile.size)})</span>
                    </p>
                    <div>
                      <Label>Name *</Label>
                      <Input
                        value={pendingTitle}
                        onChange={(e) => setPendingTitle(e.target.value)}
                        className="mt-1"
                        maxLength={64}
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={pendingDescription}
                        onChange={(e) => setPendingDescription(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    {uploadProgress !== null && (
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                        <div className="h-full bg-cyan-700" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => setPendingFile(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy || !pendingTitle.trim()}
                        onClick={handleUpload}
                      >
                        {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Upload'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === 'link' && (
              <div className="space-y-3">
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-800 dark:text-blue-300 space-y-1">
                  <p className="font-medium">Google Drive / Docs / Slides</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Share → Anyone with the link → Viewer</li>
                    <li>Copy the link and paste below</li>
                  </ol>
                </div>
                <div>
                  <Label>Public URL *</Label>
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="mt-1"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    className="mt-1"
                    maxLength={64}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={linkDescription}
                    onChange={(e) => setLinkDescription(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    disabled={isBusy || !linkUrl.trim() || !linkTitle.trim()}
                    onClick={handleLink}
                  >
                    {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Link'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files ({totalFiles})</CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-1">
            You should be cautious when downloading files online. Take normal precautions.
          </p>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No files in your brand library yet.</p>
          ) : (
            <ul className="space-y-3">
              {files.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                >
                  <FileTypeIcon mimeType={f.mimeType} filename={f.filename} />
                  <div className="min-w-0 flex-1">
                    {editingId === f.id ? (
                      <div className="space-y-2">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={64} />
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description"
                        />
                        <div className="flex gap-2">
                          <Button type="button" size="sm" disabled={isBusy} onClick={() => handleSaveEdit(f.id)}>
                            Save
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{f.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {f.source === 'external' ? 'LINK' : fileTypeLabel(f.mimeType, f.filename)}
                          {f.filesize ? ` · ${formatFileSize(f.filesize)}` : ''}
                        </p>
                        {f.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{f.description}</p>
                        )}
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-cyan-700 hover:underline mt-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open
                        </a>
                      </>
                    )}
                  </div>
                  {!readOnly && editingId !== f.id && (
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
                        onClick={() => handleDelete(f.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {currentPage > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/company/${companyUuid}/assets?filter=files&page=${currentPage - 1}`)
                  }
                >
                  Previous
                </Button>
              )}
              <span className="text-sm text-gray-500 self-center">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/company/${companyUuid}/assets?filter=files&page=${currentPage + 1}`)
                  }
                >
                  Next
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
