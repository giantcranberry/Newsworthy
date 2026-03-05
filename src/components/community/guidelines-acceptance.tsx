'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'

interface GuidelinesAcceptanceProps {
  body: string
  onAccept: () => void
}

export function GuidelinesAcceptance({ body, onAccept }: GuidelinesAcceptanceProps) {
  const [submitting, setSubmitting] = useState(false)
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    if (atBottom) setScrolledToBottom(true)
  }

  const handleAccept = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/community/guidelines/accept', { method: 'POST' })
      if (res.ok) {
        onAccept()
      }
    } catch {
      // Silent fail
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-5">
      <div className="flex items-center gap-2 mb-3">
        <i className="fa-light fa-book text-amber-600" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Community Guidelines</h3>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
        Please review and accept the community guidelines before participating.
      </p>

      <div
        onScroll={handleScroll}
        className="max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4"
      >
        <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
          <ReactMarkdown>{body}</ReactMarkdown>
        </div>
      </div>

      <Button
        onClick={handleAccept}
        disabled={submitting || !scrolledToBottom}
        className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
      >
        <CheckCircle className="h-4 w-4" />
        {submitting ? 'Accepting...' : 'I Accept the Community Guidelines'}
      </Button>

      {!scrolledToBottom && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Scroll to the bottom of the guidelines to accept.</p>
      )}
    </div>
  )
}
