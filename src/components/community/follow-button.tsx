'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { UserPlus, UserCheck } from 'lucide-react'

interface FollowButtonProps {
  userId: number
  isFollowing: boolean
  className?: string
}

export function FollowButton({ userId, isFollowing: initialFollowing, className }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/community/follows', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId }),
      })
      if (res.ok) {
        setFollowing(!following)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={following ? 'outline' : 'default'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={following
        ? `gap-1.5 text-gray-700 ${className || ''}`
        : `gap-1.5 bg-cyan-800 text-white hover:bg-cyan-900 ${className || ''}`
      }
    >
      {following ? (
        <>
          <UserCheck className="h-4 w-4" />
          Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Follow
        </>
      )}
    </Button>
  )
}
