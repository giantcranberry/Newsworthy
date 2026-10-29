'use client'

import { ExternalLink, FileArchive, FileAudio, FileText, FileVideo, Paperclip, Rss } from 'lucide-react'
import { ImageCarousel } from '@/components/pr-wizard/image-carousel'
import { InstagramEmbed } from '@/components/pr-wizard/instagram-embed'
import { formatDate, getEmbedInfo } from '@/components/pr-wizard/preview-panel'
import { sanitizeReleaseBody } from '@/lib/sanitize-body'
import { fileTypeLabel, formatFileSize } from '@/lib/file-attachments'

/*
 * Mirrors apps/website/app/(news)/news/[id_string]/[slug]/page.tsx so stakeholders
 * see the release as it will appear on newsworthy.ai. Items that only exist after
 * distribution (blockchain QR code, AI audio/video, podcast, TL;DR, syndication
 * links, media placements, translations) are listed in a note instead.
 * The website is light-mode only, so this preview is too.
 */

export interface SitePreviewImage {
  id: number
  url: string
  title?: string | null
  caption?: string | null
  imgCredits?: string | null
}

export interface SitePreviewFile {
  id: number
  title: string
  description: string | null
  filename: string | null
  url: string
  mimeType: string | null
  filesize: number | null
  source: string | null
}

export interface SitePreviewProps {
  release: {
    title: string
    abstract: string
    body: string
    location: string
    pullquote: string | null
    videoUrl: string | null
    landingPage: string | null
    publicDrive: string | null
    releaseAt: string | null
    timezone: string | null
  }
  company: {
    name: string
    logoUrl: string | null
    website: string | null
    phone: string | null
    nrUri: string | null
    uuid: string | null
    linkedinUrl: string | null
    xUrl: string | null
    facebookUrl: string | null
    instagramUrl: string | null
    youtubeUrl: string | null
  }
  contact: {
    name: string
    title: string | null
    /** The site shows an obfuscated "Email Contact" link, never the address */
    hasEmail: boolean
    phone: string | null
    avatar: string | null
  } | null
  bannerUrl: string | null
  images: SitePreviewImage[]
  files: SitePreviewFile[]
  faqs: { question: string; answer: string }[]
  categories: string[]
  recentTitles: string[]
}

const PROSE_CLASSES = 'article max-w-none prose prose-gray prose-p:text-base prose-h2:text-xl prose-h3:text-lg prose-li:list-item prose-li:pb-0 prose-li:leading-normal prose-li:my-2 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-a:text-sky-600 hover:prose-a:text-sky-500 prose-strong:text-gray-900 prose-blockquote:text-gray-600'

const DRIVE_ICONS: Record<string, string> = {
  'google.com': 'https://cdn1.newsworthy.ai/images/icons/google-drive-icon.png',
  'dropbox.com': 'https://cdn1.newsworthy.ai/images/icons/dropbox-icon.png',
  'box.com': 'https://cdn1.newsworthy.ai/images/icons/box-icon.png',
}

function driveIcon(url: string) {
  for (const [domain, icon] of Object.entries(DRIVE_ICONS)) {
    if (url.includes(domain)) return icon
  }
  return 'https://cdn1.newsworthy.ai/images/icons/default-icon.png'
}

function isSafeUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function withProtocol(url: string) {
  return url.startsWith('http') ? url : `https://${url}`
}

function hostname(url: string) {
  try {
    return new URL(withProtocol(url)).hostname
  } catch {
    return url
  }
}

/** Split body HTML after the Nth </p>, as the website's Article component does */
function splitAfterParagraph(html: string, n: number): [string, string] | null {
  const regex = /<\/p>/gi
  let count = 0
  let match
  while ((match = regex.exec(html)) !== null) {
    count++
    if (count === n) {
      const at = match.index + match[0].length
      return [html.slice(0, at), html.slice(at)]
    }
  }
  return null
}

function Pullquote({ text }: { text: string }) {
  const trimmed = text.trim()
  let content: React.ReactNode = `“${trimmed}”`
  if (/^["“]/.test(trimmed)) {
    content = trimmed
  } else {
    const match = trimmed.match(/^([\s\S]*?)\s*(--\s*|—\s*|-\s+)([\s\S]+)$/)
    if (match) content = <>{`“${match[1].trimEnd()}” `}<span className="not-italic">{match[2]}{match[3]}</span></>
  }
  return (
    <blockquote className="mt-4 border-l-4 border-cyan-700 bg-gray-50 italic text-gray-700 px-5 py-4 text-base leading-relaxed">
      <p>{content}</p>
    </blockquote>
  )
}

function FileIcon({ mimeType, filename }: { mimeType: string | null; filename: string | null }) {
  const label = fileTypeLabel(mimeType, filename)
  if (label === 'MP3' || mimeType?.startsWith('audio/')) return <FileAudio className="h-6 w-6 text-cyan-700" />
  if (label === 'MP4' || mimeType?.startsWith('video/')) return <FileVideo className="h-6 w-6 text-cyan-700" />
  if (label === 'ZIP' || mimeType?.includes('zip')) return <FileArchive className="h-6 w-6 text-cyan-700" />
  if (mimeType === 'text/uri-list') return <ExternalLink className="h-6 w-6 text-cyan-700" />
  return <FileText className="h-6 w-6 text-cyan-700" />
}

export function ReleaseSitePreview({
  release,
  company,
  contact,
  bannerUrl,
  images,
  files,
  faqs,
  categories,
  recentTitles,
}: SitePreviewProps) {
  const embed = release.videoUrl ? getEmbedInfo(release.videoUrl) : null
  const isVideoFile = !!release.videoUrl && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(release.videoUrl)
  const body = sanitizeReleaseBody((release.body || '').replace(/<p>\s*<\/p>/g, ''))
  const bodyParts = splitAfterParagraph(body, 2)
  const hasMedia = images.length > 0 || !!release.pullquote
  const companyInitial = company.name.charAt(0) || '?'
  const hasSocial = !!(company.linkedinUrl || company.xUrl || company.facebookUrl || company.instagramUrl || company.youtubeUrl || company.website)
  const showPhone = !!company.phone && company.phone !== '1111111111' && company.phone !== '111-111-1111'

  let landing: React.ReactNode = null
  if (release.landingPage) {
    const value = release.landingPage.trim()
    const anchor = value.match(/\[(.*?)\]\s?(http\S+)/)
    if (anchor && isSafeUrl(anchor[2])) {
      landing = <a href={anchor[2]} target="_blank" rel="nofollow noopener noreferrer" className="mt-3 text-sky-600 hover:underline clear-both block">{anchor[1]}</a>
    } else if (!anchor && isSafeUrl(value)) {
      landing = <a href={value} target="_blank" rel="nofollow noopener noreferrer" className="mt-3 text-sky-600 hover:underline clear-both block">Additional Information</a>
    }
  }

  const mobileMedia = hasMedia ? (
    <div className="w-full my-6 lg:hidden">
      {images.length > 0 && <ImageCarousel images={images} />}
      {release.pullquote && <Pullquote text={release.pullquote} />}
    </div>
  ) : null

  return (
    <div className="bg-white text-gray-900 rounded-lg">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <article className="lg:col-span-3 flex flex-col gap-6 w-full min-w-0">
          {/* Social Banner */}
          {bannerUrl && (
            <div className="bg-gray-100 max-h-[600px] overflow-hidden rounded-lg aspect-[1200/630]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bannerUrl} alt="Social banner" className="w-full h-full object-cover object-top" />
            </div>
          )}

          {/* Byline */}
          <div className="flex flex-col gap-3">
            <h1 className="font-serif font-normal text-2xl lg:text-4xl leading-tight">{release.title}</h1>
            <p className="text-lg md:text-xl text-gray-600 font-light leading-relaxed">{release.abstract}</p>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {categories.map((name) => (
                  <span key={name} className="text-xs font-medium px-3 py-1 rounded-full bg-sky-50 text-sky-700">{name}</span>
                ))}
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Video */}
          {embed?.type === 'youtube' && (
            <div className="flex justify-center">
              <iframe
                title="Embedded video"
                src={embed.embedUrl}
                className="aspect-video w-full h-[200px] md:h-[400px] lg:w-[600px] lg:h-[350px] rounded"
                loading="lazy"
                allowFullScreen
              />
            </div>
          )}
          {embed?.type === 'instagram' && <InstagramEmbed url={embed.url} />}
          {!embed && isVideoFile && (
            <div className="flex justify-center">
              <video src={release.videoUrl!} controls className="w-full rounded lg:w-[600px]" />
            </div>
          )}

          <div>
            {/* Dateline */}
            <p className="text-base mb-3">
              {release.location} (<span className="text-sky-600">Newsworthy.ai</span>) {formatDate(release.releaseAt, release.timezone)}
            </p>

            {/* Image carousel + pullquote, floated on desktop only */}
            {hasMedia && (
              <div className="hidden lg:block lg:float-right lg:ml-5 lg:mb-4 lg:w-[55%] lg:max-w-[425px]">
                {images.length > 0 && <ImageCarousel images={images} />}
                {release.pullquote && <Pullquote text={release.pullquote} />}
              </div>
            )}

            {bodyParts && mobileMedia ? (
              <>
                <div className={PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: bodyParts[0] }} />
                {mobileMedia}
                <div className={`${PROSE_CLASSES} [&>:first-child]:mt-[1.25em]`} dangerouslySetInnerHTML={{ __html: bodyParts[1] }} />
              </>
            ) : (
              <div className={PROSE_CLASSES} dangerouslySetInnerHTML={{ __html: body }} />
            )}

            {landing}

            {/* File Attachments */}
            {files.length > 0 && (
              <div className="border-t border-gray-200 pt-5 mt-5 clear-both">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Paperclip className="h-5 w-5 text-cyan-700" />
                  File Attachments
                </h3>
                <p className="text-xs text-gray-500 mb-3">You should be cautious when downloading files online. Take normal precautions.</p>
                <ul className="space-y-3">
                  {files.map((f) => (
                    <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 mt-0.5">
                          <FileIcon mimeType={f.mimeType} filename={f.filename} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900">{f.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-medium mr-1.5">
                              {f.source === 'external' ? 'LINK' : fileTypeLabel(f.mimeType, f.filename)}
                            </span>
                            {f.filesize ? formatFileSize(f.filesize) : null}
                          </p>
                          {f.description && <p className="text-sm text-gray-600 mt-1">{f.description}</p>}
                          {f.mimeType?.startsWith('audio/') && <audio controls preload="metadata" src={f.url} className="w-full mt-2" />}
                          {f.mimeType?.startsWith('video/') && (
                            <video controls preload="metadata" src={f.url} className="w-full max-h-56 rounded mt-2 bg-black" />
                          )}
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline mt-2">
                            <ExternalLink className="h-3.5 w-3.5" />
                            {f.source === 'external' ? 'Open link' : 'Open / download'}
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <div className="border-t border-gray-200 pt-5 mt-5 clear-both">
                <h3 className="font-semibold text-lg mb-3">Frequently Asked Questions</h3>
                <dl className="space-y-3">
                  {faqs.map((faq, i) => (
                    <div key={i}>
                      <dt className="font-medium text-sm">{faq.question}</dt>
                      <dd className="text-gray-600 mt-1 text-sm whitespace-pre-line">{faq.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="my-5 flex flex-col gap-5 clear-both">
              {/* Media Contact */}
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Media Contact</h3>
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      {contact?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={contact.avatar} alt={contact.name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-100" />
                      ) : company.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={company.logoUrl} alt={company.name} className="w-16 h-16 rounded-full object-contain bg-white border-2 border-gray-100 p-1" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xl font-bold">{companyInitial}</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {contact && (
                        <>
                          <h4 className="font-semibold text-lg text-gray-900 leading-tight">{contact.name}</h4>
                          {contact.title && <p className="text-sm text-gray-500 mt-0.5">{contact.title}</p>}
                        </>
                      )}
                      <span className="text-sm font-medium text-sky-700 mt-1 block">{company.name}</span>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                        {contact?.phone && <span className="text-sky-600">{contact.phone}</span>}
                        {contact?.hasEmail && <span className="text-sky-600">Email Contact</span>}
                      </div>
                    </div>
                  </div>
                  {hasSocial && (
                    <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100 text-sm">
                      {company.linkedinUrl && <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] hover:underline">LinkedIn</a>}
                      {company.xUrl && <a href={company.xUrl} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">X</a>}
                      {company.facebookUrl && <a href={company.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline">Facebook</a>}
                      {company.instagramUrl && <a href={company.instagramUrl} target="_blank" rel="noopener noreferrer" className="text-[#E4405F] hover:underline">Instagram</a>}
                      {company.youtubeUrl && <a href={company.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-[#FF0000] hover:underline">YouTube</a>}
                      {company.website && (
                        <>
                          <div className="w-px h-5 bg-gray-200 mx-1" />
                          <a href={withProtocol(company.website)} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline flex items-center gap-1">
                            {hostname(company.website)} <ExternalLink size={12} />
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Other Recent News */}
              {recentTitles.length > 0 ? (
                <div>
                  <h3 className="font-medium text-lg">Other Recent News for {company.name}</h3>
                  <hr />
                  <ul className="ml-5 pt-2">
                    {recentTitles.map((title, i) => (
                      <li className="list-disc" key={i}>{title}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-base mt-5">
                  <span className="font-semibold">{company.name}</span> does not have any other recent news to report at this time.
                </p>
              )}
            </div>
          </div>
        </article>

        {/* Aside */}
        <aside className="lg:col-span-1">
          <div className="w-full flex flex-col gap-6">
            {/* QR code placeholder: the blockchain record is created at distribution */}
            <div className="w-full aspect-square rounded border-2 border-dashed border-gray-200 flex items-center justify-center text-center text-xs text-gray-400 p-4">
              Blockchain QR code is generated at distribution
            </div>

            {/* Company info */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex justify-center p-6">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.name} className="rounded max-h-[80px] w-auto" />
                ) : (
                  <h4 className="text-lg font-semibold text-center">{company.name}</h4>
                )}
              </div>
              <div className="flex flex-col divide-y divide-gray-200 border-t border-gray-200">
                {showPhone && (
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-sky-600">{company.phone}</span>
                  </div>
                )}
                {company.website && (
                  <a href={withProtocol(company.website)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50">
                    <span className="text-gray-500">Website</span>
                    <span className="text-sky-600 flex items-center gap-1">{hostname(company.website)} <ExternalLink size={12} /></span>
                  </a>
                )}
                {company.nrUri && (
                  <a href={`https://newsworthy.ai/newsroom/${company.nrUri}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50">
                    <span className="text-gray-500">Newsroom</span>
                    <span className="text-sky-600 flex items-center gap-1">Visit <ExternalLink size={12} /></span>
                  </a>
                )}
                {company.uuid && (
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="text-gray-500">RSS Feed</span>
                    <span className="text-orange-500 flex items-center gap-1"><Rss className="w-3.5 h-3.5" /> Subscribe <ExternalLink size={12} /></span>
                  </div>
                )}
                {release.publicDrive && (
                  <a href={release.publicDrive} target="_blank" rel="nofollow noopener noreferrer" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50">
                    <span className="text-gray-500">Media Assets</span>
                    <span className="text-teal-600 flex items-center gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={driveIcon(release.publicDrive)} className="w-[14px] h-[14px]" alt="" />
                      Download <ExternalLink size={12} />
                    </span>
                  </a>
                )}
              </div>
            </div>

            {/* Subscribe (display only) */}
            <div className="rounded-xl bg-yellow-800/5 border border-gray-200 p-6">
              <h3 className="font-serif font-medium text-2xl flex items-center gap-10">
                Subscribe to News
                <Rss size={24} className="text-cyan-700" />
              </h3>
              <p className="text-sm text-black mt-1.5">
                Be the first to know. Receive press releases alerts from <strong>{company.name}</strong> to your email inbox or via text message.
              </p>
              <div className="mt-4 h-9 rounded-md border border-gray-200 bg-white" />
            </div>

            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-500">
              Added once the release is distributed: blockchain QR code, AI audio and video, NewsRamp podcast and TL;DR, social syndication links, share buttons, PDF download, translations and media placements.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
