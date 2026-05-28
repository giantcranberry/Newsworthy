'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

interface Brand {
  id: number
  uuid: string
  name: string
}

export function AddFeedForm({ brands }: { brands: Brand[] }) {
  const router = useRouter()
  const [companyUuid, setCompanyUuid] = useState(brands.length === 1 ? brands[0].uuid : '')
  const [feedUrl, setFeedUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!companyUuid) {
      setError('Choose a brand for this feed.')
      return
    }
    if (!feedUrl.trim()) {
      setError('Enter a podcast RSS feed URL.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/podcasts/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyUuid, feedUrl: feedUrl.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not add feed.')
        setIsSubmitting(false)
        return
      }
      router.push(`/pr/podcast/${data.uuid}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="brand">Brand profile</Label>
            <Select
              id="brand"
              value={companyUuid}
              onChange={(e) => setCompanyUuid(e.target.value)}
              disabled={isSubmitting}
              required
            >
              <option value="">Select a brand...</option>
              {brands.map((b) => (
                <option key={b.uuid} value={b.uuid}>
                  {b.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Only brands without an existing podcast feed are shown.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedUrl">Podcast RSS feed URL</Label>
            <Input
              id="feedUrl"
              type="url"
              placeholder="https://example.com/podcast.rss"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              disabled={isSubmitting}
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Paste the public RSS URL for the show. We'll fetch it and import all episodes.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need to find your podcast feed?{' '}
              <a
                href="https://rss.com/tools/find-my-feed/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-cyan-800 underline hover:text-cyan-900 dark:text-cyan-300 dark:hover:text-cyan-200"
              >
                Look it up here
              </a>
              .
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching feed…
                </>
              ) : (
                'Add Feed'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
