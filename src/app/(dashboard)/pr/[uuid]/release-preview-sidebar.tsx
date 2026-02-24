'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PreviewPanel } from '@/components/pr-wizard/preview-panel'

interface PreviewData {
  title: string | null
  abstract: string | null
  body: string | null
  location: string | null
  videoUrl: string | null
  companyName: string | null
  logoUrl: string | null
  bannerUrl: string | null
  primaryImageUrl: string | null
}

export function ReleasePreviewSidebar() {
  const { uuid } = useParams<{ uuid: string }>()
  const [data, setData] = useState<PreviewData | null>(null)

  useEffect(() => {
    fetch(`/api/pr/${uuid}/preview`)
      .then((res) => res.ok ? res.json() : null)
      .then(setData)
      .catch(() => null)
  }, [uuid])

  return (
    <div className="hidden xl:block flex-1 min-w-0 -mt-6 -mr-6 -mb-6">
      <div className="sticky top-0 h-screen overflow-y-auto scrollbar-hide bg-white border-l border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 bg-white">
          <h3 className="text-sm font-medium text-gray-700">Preview</h3>
        </div>
        {data ? (
          <PreviewPanel
            release={{
              title: data.title,
              abstract: data.abstract,
              body: data.body,
              location: data.location,
              videoUrl: data.videoUrl,
            }}
            company={data.companyName ? {
              logoUrl: data.logoUrl,
              companyName: data.companyName,
            } : undefined}
            banner={data.bannerUrl ? { url: data.bannerUrl } : null}
            images={data.primaryImageUrl ? [{ id: 1, url: data.primaryImageUrl }] : undefined}
            compact
          />
        ) : (
          <div className="p-4 space-y-4 animate-pulse">
            <div className="h-6 bg-gray-100 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-1/2" />
            <div className="space-y-2 mt-6">
              <div className="h-3 bg-gray-100 rounded" />
              <div className="h-3 bg-gray-100 rounded" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
