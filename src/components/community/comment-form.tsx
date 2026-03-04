'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'

interface CommentFormProps {
  postUuid: string
  parentId?: number | null
  onCommentAdded?: () => void
  onCancel?: () => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentForm({
  postUuid,
  parentId,
  onCommentAdded,
  onCancel,
  placeholder = 'Write a comment...',
  autoFocus = false,
}: CommentFormProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/community/posts/${postUuid}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          parentId: parentId || null,
        }),
      })

      if (res.ok) {
        setBody('')
        onCommentAdded?.()
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={1}
        autoFocus={autoFocus}
        className="flex-1 min-h-[36px] resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
          }
        }}
      />
      <div className="flex flex-col gap-1">
        <Button
          type="submit"
          size="icon"
          disabled={!body.trim() || submitting}
          className="h-9 w-9 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-9 w-9 text-gray-400"
          >
            &times;
          </Button>
        )}
      </div>
    </form>
  )
}
