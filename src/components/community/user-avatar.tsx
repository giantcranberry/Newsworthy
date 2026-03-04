'use client'

import { cn } from '@/lib/utils'

interface UserAvatarProps {
  name: string
  avatar?: string | null
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

export function UserAvatar({ name, avatar, size = 'md', className }: UserAvatarProps) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

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

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium flex-shrink-0',
        sizeClasses[size],
        className
      )}
    >
      {initials || '?'}
    </div>
  )
}
