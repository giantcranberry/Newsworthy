'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Podcast, ExternalLink, Loader2, RefreshCw, FileText, Send } from 'lucide-react'
import { TranscriptDialog } from './transcript-dialog'

const DRAFT_STATUSES = new Set(['start', 'draft', 'draftnxt'])

interface EpisodeRow {
  uuid: string
  title: string | null
  publishedAt: string | null
  durationSeconds: number | null
  episodeNumber: number | null
  seasonNumber: number | null
  imageUrl: string | null
  link: string | null
  skip: boolean
  transcriptionStatus: string
  transcriptionError: string | null
  releaseId: number | null
  releaseUuid: string | null
  releaseStatus: string | null
}

function formatDuration(sec: number | null): string | null {
  if (!sec || sec <= 0) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

function statusBadge(status: string, skip: boolean) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">Transcribed</Badge>
    case 'transcribing':
    case 'downloading':
      return <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">In progress</Badge>
    case 'failed':
      return <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">Failed</Badge>
    case 'pending':
    default:
      if (skip) {
        return <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">Skipping</Badge>
      }
      return <Badge className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">Pending</Badge>
  }
}

export function EpisodeList({
  feedUuid,
  episodes,
}: {
  feedUuid: string
  episodes: EpisodeRow[]
}) {
  const [rows, setRows] = useState(episodes)
  const [pending, startTransition] = useTransition()
  const [errorUuid, setErrorUuid] = useState<string | null>(null)
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [retryingUuid, setRetryingUuid] = useState<string | null>(null)
  const [retryError, setRetryError] = useState<{ uuid: string; message: string } | null>(null)
  const [transcriptUuid, setTranscriptUuid] = useState<string | null>(null)

  const activeCount = rows.filter((r) => !r.skip).length
  const skippedCount = rows.length - activeCount
  const allSkipped = rows.length > 0 && activeCount === 0
  // "Skippable" = not skipped AND no draft yet. Once a draft has been
  // generated (releaseId != null) the cron won't re-process the episode, so
  // bulk-skipping it does nothing useful. Hide the button when every active
  // episode already has a draft awaiting finalize.
  const skippableActiveCount = rows.filter((r) => !r.skip && r.releaseId == null).length
  const showBulkButton = allSkipped || skippableActiveCount > 0
  const nextSkipValue = !allSkipped
  const bulkLabel = allSkipped
    ? `Unskip all ${rows.length}`
    : `Skip all ${skippableActiveCount} active`

  const handleBulk = async () => {
    if (rows.length === 0) return
    const confirmMsg = nextSkipValue
      ? `Mark all ${activeCount} active episodes as skipped? You can unskip individually after.`
      : `Unskip all ${rows.length} episodes? They'll be eligible for press release generation.`
    if (!confirm(confirmMsg)) return

    setBulkError(null)
    const prev = rows
    setRows((cur) => cur.map((r) => ({ ...r, skip: nextSkipValue })))
    setBulkPending(true)
    try {
      const res = await fetch(`/api/podcasts/feeds/${feedUuid}/skip-all`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: nextSkipValue }),
      })
      if (!res.ok) {
        setRows(prev)
        const data = await res.json().catch(() => ({}))
        setBulkError(data.error || 'Failed to bulk update')
      }
    } catch (err) {
      setRows(prev)
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setBulkPending(false)
    }
  }

  const retryEpisode = async (uuid: string) => {
    setRetryError(null)
    setRetryingUuid(uuid)
    const prev = rows
    setRows((cur) =>
      cur.map((r) =>
        r.uuid === uuid ? { ...r, transcriptionStatus: 'pending', transcriptionError: null } : r,
      ),
    )
    try {
      const res = await fetch(`/api/podcasts/episodes/${uuid}/retry`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setRows(prev)
        setRetryError({ uuid, message: data.error || 'Retry failed' })
      }
    } catch (err) {
      setRows(prev)
      setRetryError({ uuid, message: err instanceof Error ? err.message : 'Retry failed' })
    } finally {
      setRetryingUuid(null)
    }
  }

  const toggleSkip = (uuid: string, nextSkip: boolean) => {
    setErrorUuid(null)
    const prev = rows
    setRows((cur) => cur.map((r) => (r.uuid === uuid ? { ...r, skip: nextSkip } : r)))
    startTransition(async () => {
      try {
        const res = await fetch(`/api/podcasts/episodes/${uuid}/skip`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skip: nextSkip }),
        })
        if (!res.ok) {
          setRows(prev)
          setErrorUuid(uuid)
        }
      } catch {
        setRows(prev)
        setErrorUuid(uuid)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-600 dark:text-gray-400">
          No episodes were found in this feed.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">{activeCount}</span> active{' '}
          <span className="text-gray-500 dark:text-gray-500">·</span>{' '}
          <span className="font-medium">{skippedCount}</span> skipped
          {bulkError && (
            <span className="ml-3 text-red-600 dark:text-red-400">{bulkError}</span>
          )}
        </div>
        {showBulkButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulk}
            disabled={bulkPending || rows.length === 0}
            className="cursor-pointer"
          >
            {bulkPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating…
              </>
            ) : (
              bulkLabel
            )}
          </Button>
        )}
      </div>
      {rows.map((ep) => (
        <Card
          key={ep.uuid}
          className={
            ep.skip
              ? 'border-gray-200 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-900/60'
              : ''
          }
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded bg-gray-100 dark:bg-gray-800">
              {ep.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ep.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Podcast className="h-5 w-5 text-gray-400" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {ep.seasonNumber != null && ep.episodeNumber != null && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    S{ep.seasonNumber}·E{ep.episodeNumber}
                  </span>
                )}
                {ep.episodeNumber != null && ep.seasonNumber == null && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Ep. {ep.episodeNumber}
                  </span>
                )}
                {statusBadge(ep.transcriptionStatus, ep.skip)}
                {ep.releaseId != null && ep.releaseStatus && !DRAFT_STATUSES.has(ep.releaseStatus) && (
                  <Badge className="bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300">
                    {ep.releaseStatus === 'review' || ep.releaseStatus === 'hold'
                      ? 'In review'
                      : ep.releaseStatus === 'sent'
                      ? 'Published'
                      : 'Release created'}
                  </Badge>
                )}
              </div>
              <h3
                className={`truncate text-sm font-medium ${
                  ep.skip
                    ? 'text-gray-500 line-through dark:text-gray-500'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {ep.title || '(untitled episode)'}
              </h3>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <code
                  title={`Copy ${ep.uuid}`}
                  onClick={() => navigator.clipboard?.writeText(ep.uuid)}
                  className="cursor-pointer rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {ep.uuid.slice(0, 8)}
                </code>
                {ep.publishedAt && <span>{new Date(ep.publishedAt).toLocaleDateString()}</span>}
                {formatDuration(ep.durationSeconds) && (
                  <span>{formatDuration(ep.durationSeconds)}</span>
                )}
                {ep.link && (
                  <a
                    href={ep.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Episode page
                  </a>
                )}
                {ep.transcriptionStatus === 'completed' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setTranscriptUuid(ep.uuid)
                    }}
                    className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-400 cursor-pointer"
                  >
                    <FileText className="h-3 w-3" />
                    View transcript
                  </button>
                )}
                {errorUuid === ep.uuid && (
                  <span className="text-red-600 dark:text-red-400">Failed to save — retry</span>
                )}
              </div>
              {ep.transcriptionStatus === 'failed' && ep.transcriptionError && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400 line-clamp-2">
                  {ep.transcriptionError}
                </p>
              )}
              {retryError?.uuid === ep.uuid && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{retryError.message}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              {ep.transcriptionStatus === 'failed' && (
                <button
                  type="button"
                  onClick={() => retryEpisode(ep.uuid)}
                  disabled={retryingUuid === ep.uuid}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 cursor-pointer"
                >
                  {retryingUuid === ep.uuid ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Retrying…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3" />
                      Retry
                    </>
                  )}
                </button>
              )}
              {ep.releaseUuid && ep.releaseStatus && DRAFT_STATUSES.has(ep.releaseStatus) && (
                <Link
                  href={`/pr/${ep.releaseUuid}`}
                  className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600"
                >
                  <Send className="h-3 w-3" />
                  Finalize &amp; Send
                </Link>
              )}
              {ep.transcriptionStatus !== 'completed' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Skip</span>
                  <Switch
                    checked={ep.skip}
                    onCheckedChange={(v) => toggleSkip(ep.uuid, v)}
                    disabled={pending}
                    aria-label={`Skip episode ${ep.title || ''}`}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
      <TranscriptDialog
        episodeUuid={transcriptUuid}
        onClose={() => setTranscriptUuid(null)}
      />
    </div>
  )
}
