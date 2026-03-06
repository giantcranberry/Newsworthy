'use client'

import { useState, useRef, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SkeletonImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  skeletonClassName?: string
  wrapperClassName?: string
}

export function SkeletonImage({
  skeletonClassName,
  wrapperClassName,
  className,
  onLoad,
  ...props
}: SkeletonImageProps) {
  const [loaded, setLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [])

  return (
    <div className={cn('relative', wrapperClassName)}>
      {!loaded && (
        <Skeleton className={cn('absolute inset-0 z-[1]', skeletonClassName)} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        className={className}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        {...props}
      />
    </div>
  )
}
