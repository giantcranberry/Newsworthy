'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ImageCarousel } from './image-carousel'
import { InstagramEmbed } from './instagram-embed'
import { normalizeTimezone, tzLabel } from '@/lib/timezones'

function hexLuminance(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16) / 255
  const g = parseInt(c.substring(2, 4), 16) / 255
  const b = parseInt(c.substring(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export interface PreviewPanelProps {
  release?: {
    title?: string | null
    abstract?: string | null
    body?: string | null
    pullquote?: string | null
    location?: string | null
    videoUrl?: string | null
    landingPage?: string | null
    releaseAt?: Date | string | null
    timezone?: string | null
  }
  company?: {
    logoUrl?: string | null
    companyName?: string | null
  }
  banner?: { url: string; caption?: string | null } | null
  textOverlay?: {
    text: string
    position: 'top' | 'center' | 'bottom'
    fontSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    color: string
    fontFamily: string
  } | null
  images?: { id: number; url: string; title?: string | null; caption?: string | null; imgCredits?: string | null }[]
  faqs?: { question: string; answer: string }[]
  compact?: boolean
  deviceMode?: 'desktop' | 'tablet' | 'mobile'
}

export function formatDate(releaseAt?: Date | string | null, timezone?: string | null) {
  const d = releaseAt ? new Date(releaseAt) : new Date()
  const tz = timezone ? normalizeTimezone(timezone) : undefined

  const weekday = d.toLocaleDateString('en-US', { weekday: 'long', ...(tz && { timeZone: tz }) })
  const month = d.toLocaleDateString('en-US', { month: 'short', ...(tz && { timeZone: tz }) })
  const dayNum = new Intl.DateTimeFormat('en-US', { day: 'numeric', ...(tz && { timeZone: tz }) }).format(d)
  const year = new Intl.DateTimeFormat('en-US', { year: 'numeric', ...(tz && { timeZone: tz }) }).format(d)
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...(tz && { timeZone: tz }),
  })
  const tzStr = timezone ? tzLabel(timezone) : (d.toLocaleDateString('en-US', { timeZoneName: 'short' }).split(', ')[1] || 'CST')

  return `${weekday} ${month} ${dayNum}, ${year} @ ${time} ${tzStr}`
}

export type EmbedInfo =
  | { type: 'youtube'; embedUrl: string }
  | { type: 'instagram'; url: string }
  | null

export function getEmbedInfo(url: string): EmbedInfo {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: 'youtube', embedUrl: `https://youtube.com/embed/${ytMatch[1]}` }

  const igMatch = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) return { type: 'instagram', url: `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/` }

  return null
}

export function PreviewPanel({
  release,
  company,
  banner,
  textOverlay,
  images,
  faqs,
  compact = false,
  deviceMode = 'desktop',
}: PreviewPanelProps) {
  const embedInfo = release?.videoUrl ? getEmbedInfo(release.videoUrl) : null

  return (
    <div className="bg-white dark:bg-gray-900">
      {/* Hero Banner */}
      {banner && (
        <div className="relative w-full aspect-[1200/630] overflow-hidden bg-gray-100 dark:bg-gray-800">
          <Image
            src={banner.url}
            alt={banner.caption || 'Social banner'}
            fill
            className="object-cover"
            unoptimized
          />
          {textOverlay?.text && (
            <div
              className="absolute inset-x-0 flex items-center justify-center px-4 pointer-events-none"
              style={{
                top: textOverlay.position === 'top' ? '6%' : textOverlay.position === 'center' ? '50%' : undefined,
                bottom: textOverlay.position === 'bottom' ? '6%' : undefined,
                transform: textOverlay.position === 'center' ? 'translateY(-50%)' : undefined,
              }}
            >
              <div
                className="rounded px-3 py-1.5"
                style={{
                  backgroundColor: hexLuminance(textOverlay.color) > 0.5 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)',
                }}
              >
                <p
                  className="text-center font-bold leading-tight whitespace-pre-line"
                  style={{
                    color: textOverlay.color,
                    fontSize: { xs: '0.4em', sm: '0.5em', md: '0.65em', lg: '0.8em', xl: '1em', '2xl': '1.2em' }[textOverlay.fontSize],
                    fontFamily: textOverlay.fontFamily === 'sans-serif' ? 'sans-serif' : `"${textOverlay.fontFamily}", sans-serif`,
                    textShadow: `0 1px 3px ${hexLuminance(textOverlay.color) > 0.5 ? '#000000' : '#ffffff'}80`,
                  }}
                >
                  {textOverlay.text}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <article className={cn('flex flex-col', compact ? 'px-4 py-4 gap-3' : 'px-6 py-6 gap-5')}>
        {/* Title */}
        <h1 id="preview-title" className={cn(
          'font-serif font-medium text-gray-900 dark:text-gray-100',
          compact ? 'text-2xl leading-snug' : 'text-2xl lg:text-4xl'
        )}>
          {release?.title || 'Untitled Press Release'}
        </h1>

        {/* Video embed if present */}
        {embedInfo?.type === 'youtube' && (
          <div className="flex justify-center">
            <iframe
              title="Embedded video"
              src={embedInfo.embedUrl}
              className={cn(
                'aspect-video w-full rounded',
                compact ? 'h-[160px]' : 'h-[200px] md:h-[400px] lg:w-[600px] lg:h-[350px]'
              )}
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}
        {embedInfo?.type === 'instagram' && (
          <InstagramEmbed url={embedInfo.url} />
        )}

        {/* Abstract */}
        <p id="preview-abstract" className={cn(
          'font-light text-gray-700 dark:text-gray-300',
          compact ? 'text-sm' : 'text-base md:text-xl'
        )}>
          {release?.abstract || 'No abstract provided.'}
        </p>

        {/* Article body section */}
        <div>
          {/* Dateline */}
          <div className="flex mb-3">
            <p className={cn('text-gray-600 dark:text-gray-400', compact && 'text-xs')}>
              {release?.location || 'Location'} (Newsworthy.ai) {formatDate(release?.releaseAt, release?.timezone)}
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
                : compact ? 'w-[65%] max-w-[320px]' : 'w-[60%] max-w-[450px]'
            )}>
              {images && images.length > 0 && (
                <ImageCarousel
                  images={images}
                  compact={compact}
                  deviceMode={deviceMode}
                />
              )}
              {release?.pullquote && (
                <blockquote id="preview-pullquote" className={cn(
                  'border-l-4 border-cyan-700 bg-gray-50 dark:bg-gray-950 italic text-gray-700 dark:text-gray-300',
                  deviceMode === 'mobile'
                    ? 'pl-4 py-3 text-sm'
                    : compact ? 'pl-3 py-2 text-xs' : 'pl-4 py-3 text-sm'
                )}>
                  <p>{/^[""\u201C]/.test(release.pullquote) ? release.pullquote : `\u201C${release.pullquote}\u201D`}</p>
                </blockquote>
              )}
            </div>
          )}

          {/* Body content */}
          <div
            id="preview-body"
            className={cn(
              'contents article max-w-none break-words prose prose-gray dark:prose-invert prose-p:text-gray-800 dark:prose-p:text-gray-200 prose-li:list-item prose-li:pb-0 prose-li:marker:text-slate-950 dark:prose-li:marker:text-slate-200 prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-a:text-sky-600 prose-a:hover:text-sky-500 prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400',
              compact
                ? 'prose-sm prose-h2:text-base'
                : 'prose-p:text-base prose-h2:text-xl'
            )}
            dangerouslySetInnerHTML={{ __html: release?.body || '<p>No content provided.</p>' }}
          />
        </div>

        {/* Landing page link */}
        {release?.landingPage && (() => {
          const value = release.landingPage.trim();
          const anchorMatch = value.match(/^\[([^\]]+)\]\s*(https?:\/\/\S+)$/);
          let anchor: string;
          let href: string;
          if (anchorMatch) {
            anchor = anchorMatch[1];
            href = anchorMatch[2];
          } else {
            anchor = 'Additional Information';
            href = value;
          }
          try {
            new URL(href);
          } catch {
            return null;
          }
          return (
            <div className={cn(
              'border-t border-gray-200 dark:border-gray-800',
              compact ? 'pt-3 mt-1' : 'pt-4 mt-2'
            )}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'text-sky-600 hover:text-sky-500 hover:underline font-medium',
                  compact ? 'text-sm' : 'text-base'
                )}
              >
                {anchor}
              </a>
            </div>
          );
        })()}

        {/* FAQ section */}
        {faqs && faqs.length > 0 && (
          <div className={cn(
            'border-t border-gray-200 dark:border-gray-800',
            compact ? 'pt-3 mt-3' : 'pt-5 mt-5'
          )}>
            <h3 className={cn(
              'font-semibold text-gray-900 dark:text-gray-100 mb-3',
              compact ? 'text-sm' : 'text-lg'
            )}>
              Frequently Asked Questions
            </h3>
            <dl className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i}>
                  <dt className={cn(
                    'font-medium text-gray-900 dark:text-gray-100',
                    compact ? 'text-xs' : 'text-sm'
                  )}>
                    {faq.question}
                  </dt>
                  <dd className={cn(
                    'text-gray-600 dark:text-gray-400 mt-1',
                    compact ? 'text-xs' : 'text-sm'
                  )}>
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
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
                'rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center',
                compact ? 'w-[80px] h-[60px]' : 'w-[150px] h-[100px]'
              )}>
                <span className="text-gray-400 text-xs">No logo</span>
              </div>
            )}
            <div className="pt-3">
              <h4 className={cn(
                'font-semibold text-gray-900 dark:text-gray-100',
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
