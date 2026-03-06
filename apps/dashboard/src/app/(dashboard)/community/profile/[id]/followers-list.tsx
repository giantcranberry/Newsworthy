'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { UserAvatar } from '@/components/community/user-avatar'
import { Skeleton } from '@/components/ui/skeleton'

interface FollowUser {
  id: number
  name: string
  avatar?: string | null
  emailHash?: string | null
  acctHandle?: string | null
  location?: string | null
}

interface FollowersListProps {
  userId: number
  type: 'followers' | 'following'
}

export function FollowersList({ userId, type }: FollowersListProps) {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/community/follows/${type}?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [userId, type])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <Link
          key={user.id}
          href={`/community/profile/${user.id}`}
          className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 hover:border-gray-300 dark:border-gray-700 transition-colors"
        >
          <UserAvatar name={user.name} avatar={user.avatar} emailHash={user.emailHash} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
            {user.acctHandle && (
              <p className="text-xs text-gray-500 dark:text-gray-400">@{user.acctHandle}</p>
            )}
            {user.location && (
              <p className="text-xs text-gray-400">{user.location}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
