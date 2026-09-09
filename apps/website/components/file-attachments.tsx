import { ExternalLink, FileText, FileAudio, FileVideo, FileArchive, Paperclip } from 'lucide-react'

export interface AttachmentFile {
  id: number
  title: string
  description?: string | null
  filename?: string | null
  url: string
  mimeType?: string | null
  filesize?: number | null
  source?: string | null
}

function fileTypeLabel(mimeType?: string | null, filename?: string | null): string {
  const ext = filename?.toLowerCase().split('.').pop() || ''
  if (ext) return ext.toUpperCase()
  if (!mimeType) return 'FILE'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('epub')) return 'EPUB'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT'
  if (mimeType.includes('word') || mimeType.includes('msword')) return 'DOC'
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS'
  if (mimeType.startsWith('audio/')) return 'MP3'
  if (mimeType.startsWith('video/')) return 'MP4'
  if (mimeType.includes('zip')) return 'ZIP'
  if (mimeType === 'text/uri-list') return 'LINK'
  return 'FILE'
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TypeIcon({ mimeType, filename }: { mimeType?: string | null; filename?: string | null }) {
  const label = fileTypeLabel(mimeType, filename)
  if (label === 'MP3' || mimeType?.startsWith('audio/')) {
    return <FileAudio className="h-6 w-6 text-cyan-700" />
  }
  if (label === 'MP4' || mimeType?.startsWith('video/')) {
    return <FileVideo className="h-6 w-6 text-cyan-700" />
  }
  if (label === 'ZIP' || mimeType?.includes('zip')) {
    return <FileArchive className="h-6 w-6 text-cyan-700" />
  }
  if (mimeType === 'text/uri-list') {
    return <ExternalLink className="h-6 w-6 text-cyan-700" />
  }
  return <FileText className="h-6 w-6 text-cyan-700" />
}

interface FileAttachmentsProps {
  files: AttachmentFile[]
}

export function FileAttachments({ files }: FileAttachmentsProps) {
  if (!files.length) return null

  return (
    <div className="border-t border-gray-200 pt-5 mt-5 clear-both">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <Paperclip className="h-5 w-5 text-cyan-700" />
        File Attachments
      </h3>
      <p className="text-xs text-gray-500 mb-3">
        You should be cautious when downloading files online. Take normal precautions.
      </p>
      <ul className="space-y-3">
        {files.map((f) => {
          const label = f.source === 'external' ? 'LINK' : fileTypeLabel(f.mimeType, f.filename)
          const canPreviewAudio = !!f.mimeType?.startsWith('audio/')
          const canPreviewVideo = !!f.mimeType?.startsWith('video/')

          return (
            <li
              key={f.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <TypeIcon mimeType={f.mimeType} filename={f.filename} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{f.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-medium mr-1.5">
                      {label}
                    </span>
                    {f.filesize ? formatFileSize(f.filesize) : null}
                  </p>
                  {f.description && (
                    <p className="text-sm text-gray-600 mt-1">{f.description}</p>
                  )}
                  {canPreviewAudio && (
                    <audio controls preload="metadata" src={f.url} className="w-full mt-2" />
                  )}
                  {canPreviewVideo && (
                    <video
                      controls
                      preload="metadata"
                      src={f.url}
                      className="w-full max-h-56 rounded mt-2 bg-black"
                    />
                  )}
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline mt-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {f.source === 'external' ? 'Open link' : 'Open / download'}
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
