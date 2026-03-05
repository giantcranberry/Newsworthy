'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { VisibilitySelector } from './visibility-selector'
import { Send, ShieldAlert, ImagePlus, X } from 'lucide-react'

interface Board {
  id: number
  name: string
  slug: string
  color: string
  staffOnly?: boolean
}

interface Company {
  id: number
  companyName: string
}

interface PostFormProps {
  boards: Board[]
  companies?: Company[]
  defaultBoardId?: number
  isStaff?: boolean
  onPostCreated?: () => void
}

const MAX_IMAGES = 4

export function PostForm({ boards, companies = [], defaultBoardId, isStaff, onPostCreated }: PostFormProps) {
  const [body, setBody] = useState('')
  const [boardId, setBoardId] = useState(defaultBoardId || boards[0]?.id || 0)
  const [visibility, setVisibility] = useState('public')
  const [visibilityCompanyId, setVisibilityCompanyId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedBoard = boards.find((b) => b.id === boardId)
  const isStaffOnlyBoard = selectedBoard?.staffOnly && !isStaff

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    setSelectedFiles((prev) => {
      const combined = [...prev, ...files]
      return combined.slice(0, MAX_IMAGES)
    })

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim() || !boardId) return

    setSubmitting(true)
    try {
      // 1. Create the post
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId,
          body: body.trim(),
          visibility,
          visibilityCompanyId: visibility === 'team' ? visibilityCompanyId : null,
        }),
      })

      if (!res.ok) return

      const post = await res.json()

      // 2. Upload images if any
      if (selectedFiles.length > 0 && post.uuid) {
        const formData = new FormData()
        selectedFiles.forEach((file) => formData.append('images', file))

        await fetch(`/api/community/posts/${post.uuid}/images`, {
          method: 'POST',
          body: formData,
        })
      }

      setBody('')
      setSelectedFiles([])
      onPostCreated?.()
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false)
    }
  }

  if (isStaffOnlyBoard) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4 text-sm text-gray-500 dark:text-gray-400">
        <ShieldAlert className="h-5 w-5 flex-shrink-0 text-gray-400" />
        <p>Only the Newsworthy team can create posts in this board. You can still view and comment on existing posts.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share something with the community..."
        rows={3}
        className="border-0 p-0 focus-visible:ring-0 resize-none"
      />

      {/* Image previews */}
      {selectedFiles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, i) => (
            <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={`Preview ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-3">
        <div className="flex items-center gap-2">
          {boards.length > 1 && (
            <Select
              value={boardId.toString()}
              onChange={(e) => setBoardId(parseInt(e.target.value))}
              className="w-auto text-xs h-8"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}

          <VisibilitySelector
            value={visibility}
            onChange={setVisibility}
            companies={companies}
            selectedCompanyId={visibilityCompanyId}
            onCompanyChange={setVisibilityCompanyId}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={selectedFiles.length >= MAX_IMAGES}
            className="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
            title={selectedFiles.length >= MAX_IMAGES ? `Maximum ${MAX_IMAGES} images` : 'Add images'}
          >
            <ImagePlus className="h-4 w-4" />
          </button>
        </div>

        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || submitting}
          className="gap-1.5 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  )
}
