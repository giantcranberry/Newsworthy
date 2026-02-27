'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'

interface CarouselImage {
  id: number
  url: string
  title?: string | null
  caption?: string | null
  imgCredits?: string | null
}

interface ImageCarouselProps {
  images: CarouselImage[]
  compact?: boolean
  deviceMode?: 'desktop' | 'tablet' | 'mobile'
}

export function ImageCarousel({ images, compact = false, deviceMode = 'desktop' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const hasMultiple = images.length > 1
  const currentImage = images[currentIndex]
  const lightboxImage = images[lightboxIndex]

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const prevSlide = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }, [])

  const nextSlide = useCallback(() => {
    setCurrentIndex((i) => Math.min(images.length - 1, i + 1))
  }, [images.length])

  const prevLightbox = useCallback(() => {
    setLightboxIndex((i) => Math.max(0, i - 1))
  }, [])

  const nextLightbox = useCallback(() => {
    setLightboxIndex((i) => Math.min(images.length - 1, i + 1))
  }, [images.length])

  useEffect(() => {
    if (!lightboxOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prevLightbox()
      if (e.key === 'ArrowRight') nextLightbox()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxOpen, prevLightbox, nextLightbox])

  if (images.length === 0) return null

  return (
    <>
      {/* Inline carousel */}
      <figure className="mb-2">
        <div className="relative overflow-hidden rounded-lg group bg-gray-50">
          {/* Slide track */}
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                className="relative w-full flex-shrink-0 cursor-pointer aspect-[4/3]"
                onClick={() => openLightbox(currentIndex)}
              >
                <Image
                  src={img.url}
                  alt={img.caption || img.title || 'News image'}
                  fill
                  className="object-cover"
                  sizes={deviceMode === 'mobile' ? '100vw' : compact ? '250px' : '350px'}
                  unoptimized
                />
              </div>
            ))}
          </div>

          {/* Prev/Next arrows */}
          {hasMultiple && currentIndex > 0 && (
            <button
              onClick={prevSlide}
              aria-label="Previous image"
              className={cn(
                'absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 cursor-pointer',
                compact ? 'p-1' : 'p-1.5'
              )}
            >
              <ChevronLeft className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          )}
          {hasMultiple && currentIndex < images.length - 1 && (
            <button
              onClick={nextSlide}
              aria-label="Next image"
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100 cursor-pointer',
                compact ? 'p-1' : 'p-1.5'
              )}
            >
              <ChevronRight className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          )}

          {/* Caption overlay */}
          {currentImage && (currentImage.caption || currentImage.title || currentImage.imgCredits) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 pointer-events-none">
              <figcaption className="text-sm text-white space-y-0.5">
                {(currentImage.caption || currentImage.title) && (
                  <p>{currentImage.caption || currentImage.title}</p>
                )}
                {currentImage.imgCredits && (
                  <p className="text-white/70 italic">Photo: {currentImage.imgCredits}</p>
                )}
              </figcaption>
            </div>
          )}
        </div>

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="flex justify-center gap-1.5 mt-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                className={cn(
                  'rounded-full transition-colors cursor-pointer',
                  compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
                  i === currentIndex ? 'bg-gray-800' : 'bg-gray-300 hover:bg-gray-400'
                )}
              />
            ))}
          </div>
        )}
      </figure>

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="max-w-[90vw] max-h-[90vh] p-2 bg-black/95 border-none sm:max-w-[90vw] [&_[data-slot=dialog-close]]:text-white/70 [&_[data-slot=dialog-close]]:hover:text-white"
          showCloseButton
        >
          <DialogTitle className="sr-only">
            {lightboxImage?.caption || lightboxImage?.title || 'Image preview'}
          </DialogTitle>

          <div className="relative flex items-center justify-center">
            {lightboxImage && (
              <Image
                src={lightboxImage.url}
                alt={lightboxImage.caption || lightboxImage.title || 'News image'}
                width={1200}
                height={900}
                className="max-w-full max-h-[80vh] object-contain"
                unoptimized
              />
            )}

            {/* Lightbox prev/next */}
            {hasMultiple && lightboxIndex > 0 && (
              <button
                onClick={prevLightbox}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 hover:bg-white/40 p-2.5 text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}
            {hasMultiple && lightboxIndex < images.length - 1 && (
              <button
                onClick={nextLightbox}
                aria-label="Next image"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/20 hover:bg-white/40 p-2.5 text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>

          {/* Lightbox caption */}
          {lightboxImage && (lightboxImage.caption || lightboxImage.title || lightboxImage.imgCredits) && (
            <div className="text-center text-white/80 text-sm mt-1">
              {(lightboxImage.caption || lightboxImage.title) && (
                <p>{lightboxImage.caption || lightboxImage.title}</p>
              )}
              {lightboxImage.imgCredits && (
                <p className="italic">Photo: {lightboxImage.imgCredits}</p>
              )}
            </div>
          )}

          {/* Lightbox dots */}
          {hasMultiple && (
            <div className="flex justify-center gap-2 mt-1">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors cursor-pointer',
                    i === lightboxIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/50'
                  )}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
