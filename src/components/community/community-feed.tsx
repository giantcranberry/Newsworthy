'use client'

import { useState, useEffect, useCallback } from 'react'
import { PostCard } from './post-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Post {
  id: number
  uuid: string
  boardName: string
  boardSlug: string
  boardColor: string
  userId: number
  userName: string
  userAvatar?: string | null
  userHandle?: string | null
  body: string
  visibility: string
  isPinned: boolean
  commentCount: number
  reactionCount: number
  images: any[]
  createdAt: string
}

interface CommunityFeedProps {
  currentUserId: number
  isAdmin?: boolean
  boardSlug?: string
  userId?: number
  refreshKey?: number
}

export function CommunityFeed({
  currentUserId,
  isAdmin,
  boardSlug,
  userId,
  refreshKey = 0,
}: CommunityFeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(true)

  const fetchPosts = useCallback(async (before?: string) => {
    const params = new URLSearchParams()
    if (boardSlug) params.set('board', boardSlug)
    if (userId) params.set('userId', userId.toString())
    if (before) params.set('before', before)
    params.set('limit', '20')

    const res = await fetch(`/api/community/posts?${params}`)
    if (!res.ok) return []
    return res.json()
  }, [boardSlug, userId])

  useEffect(() => {
    setLoading(true)
    fetchPosts().then((data) => {
      setPosts(data)
      setHasMore(data.length >= 20)
      setLoading(false)
    })
  }, [fetchPosts, refreshKey])

  const loadMore = async () => {
    if (posts.length === 0) return
    const lastPost = posts[posts.length - 1]
    const more = await fetchPosts(lastPost.createdAt)
    setPosts([...posts, ...more])
    setHasMore(more.length >= 20)
  }

  const handleDelete = (uuid: string) => {
    setPosts(posts.filter((p) => p.uuid !== uuid))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <i className="fa-light fa-messages text-3xl text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">Nothing here yet. Be the first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.uuid}
          post={post}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          showBoard={!boardSlug}
          onDelete={handleDelete}
        />
      ))}

      {hasMore && (
        <div className="text-center py-4">
          <Button variant="outline" onClick={loadMore} className="text-gray-600">
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
