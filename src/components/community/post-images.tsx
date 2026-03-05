'use client'

import { cn } from '@/lib/utils'

interface PostImage {
  id: number
  url: string
  caption?: string | null
  width?: number | null
  height?: number | null
}

interface PostImagesProps {
  images: PostImage[]
}

export function PostImages({ images }: PostImagesProps) {
  if (images.length === 0) return null

  if (images.length === 1) {
    return (
      <div className="mt-3 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
        <img
          src={images[0].url}
          alt={images[0].caption || ''}
          className="w-full h-auto"
        />
      </div>
    )
  }

  return (
    <div className={cn(
      'mt-3 grid gap-1 overflow-hidden rounded-lg',
      images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'
    )}>
      {images.slice(0, 4).map((img, idx) => (
        <div key={img.id} className="relative bg-gray-100 dark:bg-gray-800">
          <img
            src={img.url}
            alt={img.caption || ''}
            className="w-full h-48 object-contain"
          />
          {idx === 3 && images.length > 4 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <span className="text-white text-lg font-bold">+{images.length - 4}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
