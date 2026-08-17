'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FavoriteUserButton({
  userId,
  favorited,
}: {
  userId: number
  favorited: boolean
}) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isFavorited, setIsFavorited] = useState(favorited)

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}/favorite`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        setIsFavorited(!!data.favorited)
        router.refresh()
      }
    } catch {
      // keep current state
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isLoading}
      title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorited}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors cursor-pointer',
        'hover:bg-amber-50 dark:hover:bg-amber-950/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        isFavorited
          ? 'text-amber-500'
          : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Star className={cn('h-4 w-4', isFavorited && 'fill-current')} />
      )}
    </button>
  )
}
