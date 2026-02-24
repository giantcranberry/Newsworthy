'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface PreviewPanelProps {
  release?: {
    title?: string | null
    abstract?: string | null
    body?: string | null
    location?: string | null
    videoUrl?: string | null
  }
  company?: {
    logoUrl?: string | null
    companyName?: string | null
  }
  banner?: { url: string; caption?: string | null } | null
  images?: { id: number; url: string; caption?: string | null }[]
  compact?: boolean
}

export function formatDate() {
  const now = new Date()
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' })
  const month = now.toLocaleDateString('en-US', { month: 'short' })
  const day = now.getDate()
  const year = now.getFullYear()
  const time = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
  const tz = now.toLocaleDateString('en-US', { timeZoneName: 'short' }).split(', ')[1] || 'CST'

  return `${weekday} ${month} ${day}, ${year} @ ${time} ${tz}`
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (match) {
    return `https://youtube.com/embed/${match[1]}`
  }
  return null
}

export function PreviewPanel({
  release,
  company,
  banner,
  images,
  compact = false,
}: PreviewPanelProps) {
  const videoEmbedUrl = release?.videoUrl ? getYouTubeEmbedUrl(release.videoUrl) : null

  return (
    <div className="bg-white">
      <article className={cn('flex flex-col', compact ? 'px-4 py-4 gap-3' : 'px-6 py-6 gap-5')}>
        {/* Title */}
        <h1 className={cn(
          'font-serif font-medium text-gray-900',
          compact ? 'text-lg leading-snug' : 'text-2xl lg:text-4xl'
        )}>
          {release?.title || 'Untitled Press Release'}
        </h1>

        {/* Video embed if present */}
        {videoEmbedUrl && (
          <div className="flex justify-center">
            <iframe
              title="Embedded video"
              src={videoEmbedUrl}
              className={cn(
                'aspect-video w-full rounded',
                compact ? 'h-[160px]' : 'h-[200px] md:h-[400px] lg:w-[600px] lg:h-[350px]'
              )}
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}

        {/* Abstract */}
        <p className={cn(
          'font-light text-gray-700',
          compact ? 'text-sm' : 'text-base md:text-xl'
        )}>
          {release?.abstract || 'No abstract provided.'}
        </p>

        {/* Article body section */}
        <div>
          {/* Dateline */}
          <div className="flex mb-3">
            <p className={cn('text-gray-600', compact && 'text-xs')}>
              {release?.location || 'Location'} (Newsworthy.ai) {formatDate()}
            </p>
          </div>

          {/* Body content */}
          <div
            className={cn(
              'article max-w-none prose prose-gray prose-p:text-gray-800 prose-li:list-item prose-li:pb-0 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-blue-600 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-blockquote:text-gray-600',
              compact
                ? 'prose-sm prose-h2:text-base'
                : 'prose-p:text-base prose-h2:text-xl'
            )}
            dangerouslySetInnerHTML={{ __html: release?.body || '<p>No content provided.</p>' }}
          />
        </div>

        {/* News Images */}
        {images && images.length > 0 && (
          <div className="space-y-4">
            {images.map((img) => (
              <figure key={img.id} className="flex flex-col items-center">
                <div className={cn('relative w-full', compact ? 'max-w-xs' : 'max-w-md')}>
                  <Image
                    src={img.url}
                    alt={img.caption || 'News image'}
                    width={compact ? 280 : 400}
                    height={compact ? 210 : 300}
                    className="rounded-lg mx-auto"
                    style={{ maxHeight: compact ? '30vh' : '50vh', width: 'auto', height: 'auto', objectFit: 'contain' }}
                    unoptimized
                  />
                </div>
                {img.caption && (
                  <figcaption className="text-center text-sm text-gray-500 mt-2">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {/* Company info section */}
        <div className={cn(compact ? 'my-3' : 'my-5')}>
          <div className="flex items-start gap-4">
            {company?.logoUrl ? (
              <div className={cn('relative h-auto', compact ? 'w-[80px]' : 'w-[150px]')}>
                <Image
                  src={company.logoUrl}
                  alt={company.companyName || 'Company logo'}
                  width={compact ? 80 : 150}
                  height={compact ? 80 : 150}
                  className="rounded"
                  unoptimized
                />
              </div>
            ) : (
              <div className={cn(
                'rounded bg-gray-100 flex items-center justify-center',
                compact ? 'w-[80px] h-[60px]' : 'w-[150px] h-[100px]'
              )}>
                <span className="text-gray-400 text-xs">No logo</span>
              </div>
            )}
            <div className="pt-3">
              <h4 className={cn(
                'font-semibold text-gray-900',
                compact ? 'text-sm' : 'text-xl'
              )}>
                {company?.companyName || 'Company Name'}
              </h4>
            </div>
          </div>
        </div>

        {/* Social Banner preview */}
        {banner && (
          <div className="pt-5 border-t">
            <p className="text-sm text-gray-500 mb-3">Social Share Image</p>
            <div className={cn(
              'relative aspect-[1200/630] w-full rounded-lg overflow-hidden bg-gray-100 border',
              compact ? 'max-w-xs' : 'max-w-lg'
            )}>
              <Image
                src={banner.url}
                alt={banner.caption || 'Social banner'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            {banner.caption && (
              <p className="text-sm text-gray-500 mt-2 text-center">{banner.caption}</p>
            )}
          </div>
        )}
      </article>

      {/* Footer */}
      <div className={cn(
        'bg-slate-800 text-white text-center text-sm',
        compact ? 'px-4 py-2' : 'px-6 py-4'
      )}>
        <p>Newsworthy.ai - Press Release Preview</p>
      </div>
    </div>
  )
}
