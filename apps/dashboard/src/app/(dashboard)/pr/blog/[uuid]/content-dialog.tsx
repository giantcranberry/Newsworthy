'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react'

interface ArticleResponse {
  title: string | null
  text: string
  author: string | null
  link: string | null
}

function articleText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function ContentDialog({
  postUuid,
  onClose,
}: {
  postUuid: string | null
  onClose: () => void
}) {
  const [data, setData] = useState<ArticleResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!postUuid) {
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/blogs/posts/${postUuid}/content`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error || `Failed to load article (${res.status})`)
        return body as ArticleResponse
      })
      .then((body) => {
        if (!cancelled) setData(body)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load article')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [postUuid])

  const plain = data ? articleText(data.text) : ''

  return (
    <Dialog open={!!postUuid} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{data?.title || 'Article'}</DialogTitle>
        </DialogHeader>
        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading article...
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 py-4 text-sm text-red-600">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}
        {data && (
          <>
            <div className="mb-2 flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>{data.author || ''}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(plain)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-200">
              {plain}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
