'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const EMOJI_OPTIONS = [
  { key: 'like', label: 'Like', icon: '👍' },
  { key: 'heart', label: 'Heart', icon: '❤️' },
  { key: 'fire', label: 'Fire', icon: '🔥' },
  { key: 'clap', label: 'Clap', icon: '👏' },
  { key: 'insightful', label: 'Insightful', icon: '💡' },
]

interface ReactionBarProps {
  targetType: 'post' | 'comment'
  targetId: number
  reactionCount: number
  userReactions?: string[]
}

export function ReactionBar({
  targetType,
  targetId,
  reactionCount: initialCount,
  userReactions: initialReactions = [],
}: ReactionBarProps) {
  const [reactionCount, setReactionCount] = useState(initialCount)
  const [userReactions, setUserReactions] = useState<Set<string>>(new Set(initialReactions))
  const [loading, setLoading] = useState(false)

  const handleToggle = async (emoji: string) => {
    if (loading) return
    setLoading(true)

    try {
      const res = await fetch('/api/community/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, emoji }),
      })

      if (res.ok) {
        const data = await res.json()
        setUserReactions((prev) => {
          const next = new Set(prev)
          if (data.reacted) {
            next.add(emoji)
          } else {
            next.delete(emoji)
          }
          return next
        })
        setReactionCount((prev) => prev + (data.reacted ? 1 : -1))
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {EMOJI_OPTIONS.map((emoji) => {
        const active = userReactions.has(emoji.key)
        return (
          <button
            key={emoji.key}
            onClick={() => handleToggle(emoji.key)}
            disabled={loading}
            title={emoji.label}
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-1 text-xs transition-colors cursor-pointer',
              active
                ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-400 border border-cyan-300'
                : 'bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 border border-transparent hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
            )}
          >
            <span>{emoji.icon}</span>
          </button>
        )
      })}
      {reactionCount > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">{reactionCount}</span>
      )}
    </div>
  )
}
