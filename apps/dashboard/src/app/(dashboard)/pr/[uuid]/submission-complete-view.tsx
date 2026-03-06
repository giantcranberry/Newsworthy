'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { PreviewPanel } from '@/components/pr-wizard/preview-panel'
import { RetractReleaseButton } from '../retract-release-button'

interface PreviewData {
  title: string | null
  abstract: string | null
  body: string | null
  pullquote: string | null
  location: string | null
  videoUrl: string | null
  companyName: string | null
  logoUrl: string | null
  bannerUrl: string | null
  images: { id: number; url: string; title: string | null; caption: string | null; imgCredits: string | null }[]
  faqs: { question: string; answer: string }[]
}

interface SubmissionCompleteViewProps {
  releaseUuid: string
  releaseTitle: string | null
  canRetract: boolean
}

export function SubmissionCompleteView({ releaseUuid, releaseTitle, canRetract }: SubmissionCompleteViewProps) {
  const [preview, setPreview] = useState<PreviewData | null>(null)

  const fetchPreview = useCallback(() => {
    fetch(`/api/pr/${releaseUuid}/preview?t=${Date.now()}`)
      .then((res) => res.ok ? res.json() : null)
      .then(setPreview)
      .catch(() => null)
  }, [releaseUuid])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-6 flex items-start gap-4">
        <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-xl font-bold text-green-800 dark:text-green-300">Submission Complete</h2>
          <p className="text-sm text-green-700 dark:text-green-400 mt-1">
            Your press release has been successfully submitted for editorial review.
          </p>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-amber-800 dark:text-amber-300">In Editorial Review</h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            {canRetract
              ? 'This release is awaiting editorial review. You can retract it to make changes.'
              : 'This release is currently being reviewed by an editor and cannot be edited.'}
          </p>
        </div>
        {canRetract && (
          <RetractReleaseButton uuid={releaseUuid} title={releaseTitle} />
        )}
      </div>

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Live Preview</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">This is how your press release will appear once published.</p>
        </div>
        {preview ? (
          <PreviewPanel
            release={{
              title: preview.title,
              abstract: preview.abstract,
              body: preview.body,
              pullquote: preview.pullquote,
              location: preview.location,
              videoUrl: preview.videoUrl,
            }}
            company={preview.companyName ? {
              logoUrl: preview.logoUrl,
              companyName: preview.companyName,
            } : undefined}
            banner={preview.bannerUrl ? { url: preview.bannerUrl } : null}
            images={preview.images?.length > 0 ? preview.images : undefined}
            faqs={preview.faqs?.length > 0 ? preview.faqs : undefined}
            compact
            deviceMode="desktop"
          />
        ) : (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-6 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            <div className="space-y-2 mt-6">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-5/6" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
