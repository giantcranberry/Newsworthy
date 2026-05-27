'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Copy, Check } from 'lucide-react'

interface TranscriptSegment {
  start: number
  end: number
  text: string
  speaker: string | null
  confidence?: number | null
}

interface TranscriptResponse {
  episodeTitle: string | null
  text: string
  segments: TranscriptSegment[] | null
  language: string | null
  durationSeconds: number | null
  provider: string
  model: string | null
  createdAt: string
}

function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const SPEAKER_COLORS = [
  'text-cyan-700 dark:text-cyan-300',
  'text-purple-700 dark:text-purple-300',
  'text-amber-700 dark:text-amber-300',
  'text-pink-700 dark:text-pink-300',
  'text-emerald-700 dark:text-emerald-300',
  'text-orange-700 dark:text-orange-300',
]

function speakerColor(speaker: string | null): string {
  if (!speaker) return 'text-gray-700 dark:text-gray-300'
  const code = speaker.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
  const idx = ((code % SPEAKER_COLORS.length) + SPEAKER_COLORS.length) % SPEAKER_COLORS.length
  return SPEAKER_COLORS[idx]
}

interface Props {
  episodeUuid: string | null
  onClose: () => void
}

export function TranscriptDialog({ episodeUuid, onClose }: Props) {
  const [data, setData] = useState<TranscriptResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<'speakers' | 'plain'>('speakers')

  useEffect(() => {
    if (!episodeUuid) {
      setData(null)
      setError(null)
      setCopied(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    fetch(`/api/podcasts/episodes/${episodeUuid}/transcript`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(body.error || `Failed to load transcript (${res.status})`)
        } else {
          setData(body as TranscriptResponse)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load transcript')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [episodeUuid])

  const handleCopy = async () => {
    if (!data) return
    await navigator.clipboard.writeText(data.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasSegments = data?.segments && data.segments.length > 0

  return (
    <Dialog open={!!episodeUuid} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {data?.episodeTitle ? `Transcript — ${data.episodeTitle}` : 'Transcript'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-600 dark:text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading transcript…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
              <div className="flex flex-wrap items-center gap-3">
                {data.durationSeconds != null && (
                  <span>Duration: {formatTime(data.durationSeconds)}</span>
                )}
                {data.language && <span>Language: {data.language}</span>}
                <span>
                  {data.provider}
                  {data.model ? ` · ${data.model}` : ''}
                </span>
                <span>Transcribed: {new Date(data.createdAt).toLocaleString()}</span>
              </div>
              {hasSegments && (
                <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setViewMode('speakers')}
                    className={
                      'px-2.5 py-1 text-xs font-medium cursor-pointer ' +
                      (viewMode === 'speakers'
                        ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300'
                        : 'text-gray-600 dark:text-gray-400')
                    }
                  >
                    Speakers
                  </button>
                  <button
                    onClick={() => setViewMode('plain')}
                    className={
                      'border-l border-gray-200 px-2.5 py-1 text-xs font-medium cursor-pointer dark:border-gray-700 ' +
                      (viewMode === 'plain'
                        ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300'
                        : 'text-gray-600 dark:text-gray-400')
                    }
                  >
                    Plain text
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {viewMode === 'speakers' && hasSegments ? (
                <div className="space-y-3 py-2">
                  {data.segments!.map((seg, i) => (
                    <div key={i} className="text-sm">
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className={`font-semibold ${speakerColor(seg.speaker)}`}>
                          {seg.speaker ? `Speaker ${seg.speaker}` : 'Speaker'}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatTime(seg.start)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                        {seg.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="whitespace-pre-wrap py-2 text-sm text-gray-800 dark:text-gray-200">
                  {data.text}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-800">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {data.text.length.toLocaleString()} characters
                {hasSegments && ` · ${data.segments!.length} segments`}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1 cursor-pointer">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy text'}
                </Button>
                <Button size="sm" onClick={onClose} className="cursor-pointer">
                  Close
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
