'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Reply, Trash2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserAvatar } from './user-avatar'
import { ReactionBar } from './reaction-bar'
import { CommentForm } from './comment-form'

interface Comment {
  id: number
  uuid: string
  postId: number
  parentId: number | null
  depth: number
  userId: number
  userName: string
  userAvatar?: string | null
  userHandle?: string | null
  body: string
  isDeleted: boolean
  reactionCount: number
  createdAt: string
  userReactions?: string[]
}

interface CommentThreadProps {
  comments: Comment[]
  postUuid: string
  currentUserId: number
  isAdmin?: boolean
  onRefresh: () => void
}

const MAX_DEPTH = 4

export function CommentThread({
  comments,
  postUuid,
  currentUserId,
  isAdmin,
  onRefresh,
}: CommentThreadProps) {
  // Build tree from flat list
  const rootComments = comments.filter((c) => !c.parentId)
  const childMap = new Map<number, Comment[]>()
  for (const c of comments) {
    if (c.parentId) {
      if (!childMap.has(c.parentId)) childMap.set(c.parentId, [])
      childMap.get(c.parentId)!.push(c)
    }
  }

  return (
    <div className="space-y-4">
      {rootComments.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          childMap={childMap}
          postUuid={postUuid}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  )
}

function CommentNode({
  comment,
  childMap,
  postUuid,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  comment: Comment
  childMap: Map<number, Comment[]>
  postUuid: string
  currentUserId: number
  isAdmin?: boolean
  onRefresh: () => void
}) {
  const [replying, setReplying] = useState(false)
  const children = childMap.get(comment.id) || []
  const isOwner = comment.userId === currentUserId
  const timeAgo = getTimeAgo(new Date(comment.createdAt))

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return
    const res = await fetch(`/api/community/comments/${comment.uuid}`, { method: 'DELETE' })
    if (res.ok) onRefresh()
  }

  if (comment.isDeleted) {
    return (
      <div className={cn('text-sm text-gray-400 italic', comment.depth > 0 && 'ml-6 pl-4 border-l border-gray-200 dark:border-gray-800')}>
        [deleted]
        {children.length > 0 && (
          <div className="mt-2 space-y-3">
            {children.map((child) => (
              <CommentNode
                key={child.id}
                comment={child}
                childMap={childMap}
                postUuid={postUuid}
                currentUserId={currentUserId}
                isAdmin={isAdmin}
                onRefresh={onRefresh}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(comment.depth > 0 && 'ml-6 pl-4 border-l border-gray-200 dark:border-gray-800')}>
      <div className="flex items-start gap-2">
        <Link href={`/community/profile/${comment.userId}`}>
          <UserAvatar name={comment.userName} avatar={comment.userAvatar} size="sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/community/profile/${comment.userId}`}
              className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400"
            >
              {comment.userName}
            </Link>
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
            {comment.body}
          </p>

          {/* Actions */}
          <div className="mt-2 flex items-center gap-3">
            <ReactionBar
              targetType="comment"
              targetId={comment.id}
              reactionCount={comment.reactionCount}
              userReactions={comment.userReactions}
            />

            {comment.depth < MAX_DEPTH && (
              <button
                onClick={() => setReplying(!replying)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-cyan-800 dark:text-cyan-400 cursor-pointer"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>
            )}

            {comment.depth >= MAX_DEPTH && children.length > 0 && (
              <Link
                href={`/community/posts/${postUuid}`}
                className="text-xs text-cyan-700 hover:text-cyan-800 dark:text-cyan-400"
              >
                Continue thread...
              </Link>
            )}

            {(isOwner || isAdmin) && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 dark:text-red-400 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Reply form */}
          {replying && (
            <div className="mt-2">
              <CommentForm
                postUuid={postUuid}
                parentId={comment.id}
                autoFocus
                placeholder={`Reply to ${comment.userName}...`}
                onCommentAdded={() => {
                  setReplying(false)
                  onRefresh()
                }}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {children.length > 0 && comment.depth < MAX_DEPTH && (
        <div className="mt-3 space-y-3">
          {children.map((child) => (
            <CommentNode
              key={child.id}
              comment={child}
              childMap={childMap}
              postUuid={postUuid}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
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
  if (minutes < 60) return `${minutes}m`
  if (hours < 24) return `${hours}h`
  if (days < 7) return `${days}d`
  return date.toLocaleDateString()
}
