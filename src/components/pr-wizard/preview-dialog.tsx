'use client'

import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Release {
  uuid: string
  title?: string | null
  abstract?: string | null
  body?: string | null
  location?: string | null
  videoUrl?: string | null
}

interface Company {
  logoUrl?: string | null
  companyName?: string | null
}

interface Banner {
  url: string
  caption?: string | null
}

interface NewsImage {
  id: number
  url: string
  caption?: string | null
}

interface PreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  release?: Release
  company?: Company
  banner?: Banner | null
  images?: NewsImage[]
}

function formatDate() {
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

function getYouTubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (match) {
    return `https://youtube.com/embed/${match[1]}`
  }
  return null
}

export function PreviewDialog({
  open,
  onOpenChange,
  release,
  company,
  banner,
  images,
}: PreviewDialogProps) {
  const videoEmbedUrl = release?.videoUrl ? getYouTubeEmbedUrl(release.videoUrl) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="text-lg font-medium">Press Release Preview</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto">
          <div className="bg-white">
            {/* Main article content */}
            <article className="px-6 py-6 flex flex-col gap-5">
              {/* Title */}
              <h1 className="font-serif font-medium text-2xl lg:text-4xl text-gray-900">
                {release?.title || 'Untitled Press Release'}
              </h1>

              {/* Video embed if present */}
              {videoEmbedUrl && (
                <div className="flex justify-center">
                  <iframe
                    title="Embedded video"
                    src={videoEmbedUrl}
                    className="aspect-video w-full h-[200px] md:h-[400px] lg:w-[600px] lg:h-[350px] rounded"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Abstract */}
              <p className="text-base md:text-xl font-light text-gray-700">
                {release?.abstract || 'No abstract provided.'}
              </p>

              {/* Article body section */}
              <div>
                {/* Dateline */}
                <div className="flex mb-3">
                  <p className="text-gray-600">
                    {release?.location || 'Location'} (Newsworthy.ai) {formatDate()}
                  </p>
                </div>

                {/* Body content */}
                <div
                  className="article max-w-none prose prose-p:text-base prose-p:text-black prose-li:list-item prose-li:pb-0 prose-li:marker:text-slate-950 prose-ol:list-decimal prose-h2:text-xl prose-a:text-blue-600"
                  dangerouslySetInnerHTML={{ __html: release?.body || '<p>No content provided.</p>' }}
                />
              </div>

              {/* News Images */}
              {images && images.length > 0 && (
                <div className="space-y-4">
                  {images.map((img) => (
                    <figure key={img.id} className="flex flex-col items-center">
                      <div className="relative w-full max-w-md">
                        <Image
                          src={img.url}
                          alt={img.caption || 'News image'}
                          width={400}
                          height={300}
                          className="rounded-lg mx-auto"
                          style={{ maxHeight: '50vh', width: 'auto', height: 'auto', objectFit: 'contain' }}
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
              <div className="my-5">
                <div className="flex items-start gap-4">
                  {company?.logoUrl ? (
                    <div className="relative w-[150px] h-auto">
                      <Image
                        src={company.logoUrl}
                        alt={company.companyName || 'Company logo'}
                        width={150}
                        height={150}
                        className="rounded"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-[150px] h-[100px] rounded bg-gray-100 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No logo</span>
                    </div>
                  )}
                  <div className="pt-3">
                    <h4 className="text-xl font-semibold text-gray-900">
                      {company?.companyName || 'Company Name'}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Social Banner preview */}
              {banner && (
                <div className="pt-5 border-t">
                  <p className="text-sm text-gray-500 mb-3">Social Share Image</p>
                  <div className="relative aspect-[1200/630] w-full max-w-lg rounded-lg overflow-hidden bg-gray-100 border">
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
            <div className="bg-slate-800 text-white px-6 py-4 text-center text-sm">
              <p>Newsworthy.ai - Press Release Preview</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
