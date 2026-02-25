'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface PreviewPanelProps {
  release?: {
    title?: string | null
    abstract?: string | null
    body?: string | null
    pullquote?: string | null
    location?: string | null
    videoUrl?: string | null
  }
  company?: {
    logoUrl?: string | null
    companyName?: string | null
  }
  banner?: { url: string; caption?: string | null } | null
  images?: { id: number; url: string; title?: string | null; caption?: string | null; imgCredits?: string | null }[]
  compact?: boolean
  deviceMode?: 'desktop' | 'tablet' | 'mobile'
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
  deviceMode = 'desktop',
}: PreviewPanelProps) {
  const videoEmbedUrl = release?.videoUrl ? getYouTubeEmbedUrl(release.videoUrl) : null

  return (
    <div className="bg-white">
      {/* Hero Banner */}
      {banner && (
        <div className="relative w-full aspect-[1200/630] overflow-hidden bg-gray-100">
          <Image
            src={banner.url}
            alt={banner.caption || 'Social banner'}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      <article className={cn('flex flex-col', compact ? 'px-4 py-4 gap-3' : 'px-6 py-6 gap-5')}>
        {/* Title */}
        <h1 className={cn(
          'font-serif font-medium text-gray-900',
          compact ? 'text-2xl leading-snug' : 'text-2xl lg:text-4xl'
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

          {/* Image + pullquote: floated right on desktop/tablet, stacked full-width on mobile */}
          {((images && images.length > 0) || release?.pullquote) && (
            <div className={cn(
              deviceMode === 'mobile'
                ? 'w-full mb-4'
                : 'float-right ml-5 mb-4',
              deviceMode === 'mobile'
                ? ''
                : compact ? 'w-[55%] max-w-[250px]' : 'w-[50%] max-w-[350px]'
            )}>
              {images && images.length > 0 && images.map((img) => (
                <figure key={img.id} className="mb-2">
                  <Image
                    src={img.url}
                    alt={img.caption || img.title || 'News image'}
                    width={deviceMode === 'mobile' ? 400 : compact ? 200 : 300}
                    height={deviceMode === 'mobile' ? 300 : compact ? 150 : 225}
                    className="rounded-lg w-full h-auto"
                    style={{ objectFit: 'contain' }}
                    unoptimized
                  />
                  {(img.caption || img.title || img.imgCredits) && (
                    <figcaption className="text-xs text-gray-500 mt-1.5 space-y-0.5">
                      {(img.caption || img.title) && <p>{img.caption || img.title}</p>}
                      {img.imgCredits && <p className="italic">Photo: {img.imgCredits}</p>}
                    </figcaption>
                  )}
                </figure>
              ))}
              {release?.pullquote && (
                <blockquote className={cn(
                  'border-l-4 border-cyan-700 bg-gray-50 italic text-gray-700',
                  deviceMode === 'mobile'
                    ? 'pl-4 py-3 text-sm'
                    : compact ? 'pl-3 py-2 text-xs' : 'pl-4 py-3 text-sm'
                )}>
                  <p>&ldquo;{release.pullquote}&rdquo;</p>
                </blockquote>
              )}
            </div>
          )}

          {/* Body content */}
          <div
            className={cn(
              'article max-w-none prose prose-gray prose-p:text-gray-800 prose-li:list-item prose-li:pb-0 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-sky-600 prose-a:hover:text-sky-500 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-blockquote:text-gray-600',
              compact
                ? 'prose-sm prose-h2:text-base'
                : 'prose-p:text-base prose-h2:text-xl'
            )}
            dangerouslySetInnerHTML={{ __html: release?.body || '<p>No content provided.</p>' }}
          />
        </div>

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
