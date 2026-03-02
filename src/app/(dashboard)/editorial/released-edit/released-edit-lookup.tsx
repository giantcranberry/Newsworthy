'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ReleasedEditLookup() {
  const router = useRouter()
  const [prId, setPrId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const extractPrId = (input: string): string => {
    const trimmed = input.trim()

    // Check if it's a URL containing /news/YYYYMMDD{prid}/
    const urlMatch = trimmed.match(/\/news\/\d{8}(\d+)/)
    if (urlMatch) return urlMatch[1]

    // Otherwise treat as a plain numeric ID
    return trimmed
  }

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prId.trim()) return

    const resolvedId = extractPrId(prId)
    if (!resolvedId || !/^\d+$/.test(resolvedId)) {
      setError('Could not extract a valid PR ID from the input.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/editorial/released-edit?prId=${resolvedId}`)
      const data = await res.json()

      if (res.ok && data.release) {
        if (data.release.status !== 'sent') {
          setError(`Press release ${resolvedId} is not in sent/released status. Current status: ${data.release.status}`)
        } else {
          router.push(`/editorial/released-edit/${resolvedId}`)
        }
      } else {
        setError(data.error || `Press release with ID ${resolvedId} not found.`)
      }
    } catch (e) {
      setError('Failed to look up press release')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card data-tour="released-edit-lookup">
      <CardHeader>
        <CardTitle>Find Release</CardTitle>
        <CardDescription>Enter a press release ID or paste a newsworthy.ai URL</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLookup} className="flex items-end gap-3">
          <div data-tour="released-edit-input" className="flex-1">
            <Label htmlFor="prId">Press Release ID or URL</Label>
            <Input
              id="prId"
              type="text"
              placeholder="e.g., 2181 or https://www.newsworthy.ai/news/202602252181/..."
              value={prId}
              onChange={(e) => setPrId(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button
            data-tour="released-edit-submit"
            type="submit"
            className="bg-cyan-800 text-white hover:bg-cyan-900"
            disabled={loading || !prId.trim()}
          >
            {loading ? 'Looking up...' : 'Find Release'}
          </Button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
