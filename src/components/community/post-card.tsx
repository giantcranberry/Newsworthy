'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { MoreHorizontal, Pin, Pencil, Trash2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { UserAvatar } from './user-avatar'
import { VisibilityBadge } from './visibility-badge'
import { PostImages } from './post-images'
import { ReactionBar } from './reaction-bar'

interface PostImage {
  id: number
  url: string
  caption?: string | null
  width?: number | null
  height?: number | null
}

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
  userLocation?: string | null
  body: string
  visibility: string
  isPinned: boolean
  commentCount: number
  reactionCount: number
  images: PostImage[]
  createdAt: string
  userReactions?: string[]
}

interface PostCardProps {
  post: Post
  currentUserId: number
  isAdmin?: boolean
  showBoard?: boolean
  onDelete?: (uuid: string) => void
}

export function PostCard({ post, currentUserId, isAdmin, showBoard = true, onDelete }: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [pinned, setPinned] = useState(post.isPinned)
  const isOwner = post.userId === currentUserId

  const timeAgo = getTimeAgo(new Date(post.createdAt))

  const handlePin = async () => {
    setMenuOpen(false)
    const res = await fetch(`/api/community/posts/${post.uuid}/pin`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setPinned(data.isPinned)
    }
  }

  const handleDelete = async () => {
    setMenuOpen(false)
    if (!confirm('Delete this post?')) return
    const res = await fetch(`/api/community/posts/${post.uuid}`, { method: 'DELETE' })
    if (res.ok) {
      onDelete?.(post.uuid)
    }
  }

  return (
    <div className={cn(
      'rounded-lg border bg-white p-4',
      pinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/community/profile/${post.userId}`}>
            <UserAvatar name={post.userName} avatar={post.userAvatar} size="md" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/community/profile/${post.userId}`}
                className="font-medium text-gray-900 hover:text-cyan-800 text-sm"
              >
                {post.userName}
              </Link>
              {post.userHandle && (
                <span className="text-xs text-gray-400">@{post.userHandle}</span>
              )}
              {post.visibility !== 'public' && <VisibilityBadge visibility={post.visibility} />}
              {pinned && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {showBoard && (
                <>
                  <Link
                    href={`/community/boards/${post.boardSlug}`}
                    className="hover:text-cyan-800"
                    style={{ color: post.boardColor }}
                  >
                    {post.boardName}
                  </Link>
                  <span>&middot;</span>
                </>
              )}
              <span>{timeAgo}</span>
              {post.userLocation && (
                <>
                  <span>&middot;</span>
                  <span>{post.userLocation}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {(isOwner || isAdmin) && (
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1 bg-white">
              {isAdmin && (
                <button
                  onClick={handlePin}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Pin className="h-4 w-4" />
                  {pinned ? 'Unpin' : 'Pin'}
                </button>
              )}
              {isOwner && (
                <Link
                  href={`/community/posts/${post.uuid}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Link>
              )}
              <button
                onClick={handleDelete}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Body */}
      <div className="mt-3 text-sm text-gray-800 whitespace-pre-wrap break-words prose prose-sm max-w-none">
        {post.body}
      </div>

      {/* Images */}
      <PostImages images={post.images} />

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
        <ReactionBar
          targetType="post"
          targetId={post.id}
          reactionCount={post.reactionCount}
          userReactions={post.userReactions}
        />

        <Link
          href={`/community/posts/${post.uuid}`}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-cyan-800 transition-colors"
        >
          <MessageSquare className="h-4 w-4" />
          {post.commentCount > 0 ? `${post.commentCount} comments` : 'Comment'}
        </Link>
      </div>
    </div>
  )
}

function getTimeAgo(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
