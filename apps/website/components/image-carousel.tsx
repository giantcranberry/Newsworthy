'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CarouselImage {
  id: number
  url: string
  title?: string | null
  caption?: string | null
  imgCredits?: string | null
}

interface ImageCarouselProps {
  images: CarouselImage[]
}

export function ImageCarousel({ images }: ImageCarouselProps) {
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
      if (e.key === 'Escape') setLightboxOpen(false)
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
        <div
          className="overflow-hidden rounded-lg group bg-gray-50 cursor-pointer"
          onClick={() => openLightbox(currentIndex)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImage.url}
            alt={currentImage.caption || currentImage.title || 'News image'}
            className="w-full h-auto object-cover rounded-lg"
            loading="eager"
          />
        </div>

        {/* Caption below image */}
        {currentImage && (currentImage.caption || currentImage.title || currentImage.imgCredits) && (
          <figcaption className="text-xs text-gray-500 mt-1.5 space-y-0.5">
            {(currentImage.caption || currentImage.title) && (
              <p>{currentImage.caption || currentImage.title}</p>
            )}
            {currentImage.imgCredits && (
              <p className="italic">Photo: {currentImage.imgCredits}</p>
            )}
          </figcaption>
        )}

        {/* Navigation row: arrows + dots */}
        {hasMultiple && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={prevSlide}
              disabled={currentIndex === 0}
              aria-label="Previous image"
              className="rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default p-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Go to image ${i + 1}`}
                  className={cn(
                    'rounded-full transition-colors cursor-pointer h-2 w-2',
                    i === currentIndex ? 'bg-gray-800' : 'bg-gray-300 hover:bg-gray-400'
                  )}
                />
              ))}
            </div>
            <button
              onClick={nextSlide}
              disabled={currentIndex === images.length - 1}
              aria-label="Next image"
              className="rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default p-1.5"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </figure>

      {/* Fullscreen lightbox overlay */}
      {lightboxOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close lightbox"
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors cursor-pointer"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Image + caption + dots grouped together */}
          <div className="relative flex flex-col items-center">
            {lightboxImage && (
              <Image
                src={lightboxImage.url}
                alt={lightboxImage.caption || lightboxImage.title || 'News image'}
                width={800}
                height={600}
                className="max-w-[70vw] max-h-[70vh] object-contain rounded-xl"
                unoptimized
              />
            )}

            {/* Lightbox caption */}
            {lightboxImage && (lightboxImage.caption || lightboxImage.title || lightboxImage.imgCredits) && (
              <div className="text-center text-white/80 text-sm px-4 mt-3">
                {(lightboxImage.caption || lightboxImage.title) && (
                  <p>{lightboxImage.caption || lightboxImage.title}</p>
                )}
                {lightboxImage.imgCredits && (
                  <p className="italic">Photo: {lightboxImage.imgCredits}</p>
                )}
              </div>
            )}

            {/* Lightbox prev/next */}
            {hasMultiple && lightboxIndex > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); prevLightbox() }}
                aria-label="Previous image"
                className="absolute left-[-5rem] top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-2.5 text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
            )}
            {hasMultiple && lightboxIndex < images.length - 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); nextLightbox() }}
                aria-label="Next image"
                className="absolute right-[-5rem] top-1/2 -translate-y-1/2 rounded-full bg-white/10 hover:bg-white/20 p-2.5 text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
