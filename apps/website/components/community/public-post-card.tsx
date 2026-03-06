import Link from 'next/link'
import { MessageSquare, Heart, Pin } from 'lucide-react'
import { PostImages } from './post-images'
import { Avatar } from './avatar'
import { linkifyHtml } from '@/lib/linkify-html'

interface PostImage {
  id: number
  url: string
  caption?: string | null
  width?: number | null
  height?: number | null
}

interface PublicPost {
  uuid: string
  body: string
  isPinned: boolean
  commentCount: number
  reactionCount: number
  createdAt: Date
  boardName: string
  boardSlug: string
  boardColor: string
  userName: string
  userAvatar: string | null
  userEmailHash: string | null
  images: PostImage[]
}

interface PublicPostCardProps {
  post: PublicPost
  showBoard?: boolean
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

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function PublicPostCard({ post, showBoard = true }: PublicPostCardProps) {
  const timeAgo = getTimeAgo(new Date(post.createdAt))

  return (
    <div className={`rounded-lg border bg-white p-4 ${post.isPinned ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={post.userName} avatar={post.userAvatar} emailHash={post.userEmailHash} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{post.userName}</span>
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <Pin className="h-3 w-3" /> Pinned
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {showBoard && (
              <>
                <Link
                  href={`/community/board/${post.boardSlug}`}
                  className="hover:underline"
                  style={{ color: post.boardColor }}
                >
                  {post.boardName}
                </Link>
                <span>&middot;</span>
              </>
            )}
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>

      {/* Images */}
      <PostImages images={post.images} />

      {/* Body - trusted HTML from authenticated TinyMCE input */}
      <Link href={`/community/post/${post.uuid}`}>
        <div
          className="mt-3 text-sm text-gray-800 break-words prose prose-sm max-w-none line-clamp-6"
          dangerouslySetInnerHTML={{ __html: linkifyHtml(post.body) }}
        />
      </Link>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-400">
        {post.reactionCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {post.reactionCount}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" />
          {post.commentCount > 0 ? `${post.commentCount} comments` : '0 comments'}
        </span>
        <Link
          href={`/community/post/${post.uuid}`}
          className="ml-auto text-cyan-700 hover:text-cyan-900 hover:underline"
        >
          Read more
        </Link>
      </div>
    </div>
  )
}
