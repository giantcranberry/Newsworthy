'use client'

import { useState } from 'react'

interface AvatarProps {
  name: string
  avatar?: string | null
  emailHash?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-sm',
}

export function Avatar({ name, avatar, emailHash, size = 'md', className = '' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const [gravatarFailed, setGravatarFailed] = useState(false)
  const initial = name ? name.charAt(0).toUpperCase() : '?'
  const sizeClass = sizes[size]

  // Try uploaded avatar first
  if (avatar && !imgFailed) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  // Try gravatar
  if (emailHash && !gravatarFailed) {
    return (
      <img
        src={`https://www.gravatar.com/avatar/${emailHash}?s=96&d=404`}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setGravatarFailed(true)}
      />
    )
  }

  // Fallback to initial
  return (
    <div className={`flex items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 flex-shrink-0 ${sizeClass} ${className}`}>
      {initial}
    </div>
  )
}
