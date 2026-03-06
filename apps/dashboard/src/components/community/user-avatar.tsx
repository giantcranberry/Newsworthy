'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatar?: string | null
  emailHash?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizePx = { sm: 32, md: 40, lg: 56 }

function resolveAvatarUrl(url: string, size: 'sm' | 'md' | 'lg'): string {
  const px = sizePx[size] * 2 // 2x for retina
  // Filestack URLs with /RESIZE/ placeholder — swap for actual resize params
  if (url.includes('/RESIZE/')) {
    return url.replace('/RESIZE/', `/resize=width:${px},height:${px},fit:crop/`)
  }
  return url
}

export function UserAvatar({ name, avatar, emailHash, size = 'md', className }: UserAvatarProps) {
  const [gravatarFailed, setGravatarFailed] = useState(false)

  const initial = name
    ? name.charAt(0).toUpperCase()
    : '?'

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-lg',
  }

  if (avatar) {
    return (
      <img
        src={resolveAvatarUrl(avatar, size)}
        alt={name}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  if (emailHash && !gravatarFailed) {
    const px = sizePx[size] * 2
    return (
      <img
        src={`https://www.gravatar.com/avatar/${emailHash}?s=${px}&d=404`}
        alt={name}
        onError={() => setGravatarFailed(true)}
        className={cn(
          'rounded-full object-cover flex-shrink-0',
          sizeClasses[size],
          className
        )}
      />
    )
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 font-medium flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {initial || '?'}
    </div>
  )
}
