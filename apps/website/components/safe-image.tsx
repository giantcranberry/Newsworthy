'use client'

import Image from 'next/image'
import { useState } from 'react'

export default function SafeImage({
  src,
  alt,
  width,
  height,
  className,
}: {
  src: string
  alt: string
  width: number
  height: number
  className?: string
}) {
  const [hidden, setHidden] = useState(false)

  if (hidden) return null

  return (
    <Image
      className={className}
      src={src}
      width={width}
      height={height}
      alt={alt}
      onError={() => setHidden(true)}
    />
  )
}
