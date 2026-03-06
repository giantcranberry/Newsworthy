'use client'

import { useState } from 'react'
import Image, { ImageProps } from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface SkeletonNextImageProps extends ImageProps {
  skeletonClassName?: string
  wrapperClassName?: string
}

export function SkeletonNextImage({
  skeletonClassName,
  wrapperClassName,
  className,
  onLoad,
  ...props
}: SkeletonNextImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className={cn('relative', wrapperClassName)}>
      {!loaded && (
        <Skeleton className={cn('absolute inset-0 z-[1]', skeletonClassName)} />
      )}
      <Image
        className={className}
        onLoadingComplete={() => setLoaded(true)}
        onLoad={(e) => {
          setLoaded(true)
          if (typeof onLoad === 'function') onLoad(e)
        }}
        {...props}
      />
    </div>
  )
}
