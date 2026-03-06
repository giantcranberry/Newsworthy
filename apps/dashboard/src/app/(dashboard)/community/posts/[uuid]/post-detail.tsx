'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { UserAvatar } from '@/components/community/user-avatar'
import { VisibilityBadge } from '@/components/community/visibility-badge'
import { PostImages } from '@/components/community/post-images'
import { ReactionBar } from '@/components/community/reaction-bar'
import { CommentThread } from '@/components/community/comment-thread'
import { CommentForm } from '@/components/community/comment-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Pin } from 'lucide-react'
import { linkifyHtml } from '@/lib/linkify-html'

interface PostDetailProps {
  uuid: string
  currentUserId: number
  isAdmin?: boolean
}

export function PostDetail({ uuid, currentUserId, isAdmin }: PostDetailProps) {
  const [post, setPost] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPost = useCallback(async () => {
    const res = await fetch(`/api/community/posts/${uuid}`)
    if (res.ok) {
      setPost(await res.json())
    }
  }, [uuid])

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/community/posts/${uuid}/comments`)
    if (res.ok) {
      setComments(await res.json())
    }
  }, [uuid])

  useEffect(() => {
    Promise.all([fetchPost(), fetchComments()]).then(() => setLoading(false))
  }, [fetchPost, fetchComments])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-8 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Post not found or you don&apos;t have access.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Post */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        <div className="flex items-start gap-3">
          <Link href={`/community/profile/${post.userId}`}>
            <UserAvatar name={post.userName} avatar={post.userAvatar} emailHash={post.userEmailHash} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/community/profile/${post.userId}`}
                className="font-medium text-gray-900 dark:text-gray-100 hover:text-cyan-800 dark:text-cyan-400"
              >
                {post.userName}
              </Link>
              {post.userHandle && (
                <span className="text-xs text-gray-400">@{post.userHandle}</span>
              )}
              {post.visibility !== 'public' && <VisibilityBadge visibility={post.visibility} />}
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <Link href={`/community/boards/${post.boardSlug}`} className="hover:text-cyan-800 dark:text-cyan-400" style={{ color: post.boardColor }}>
                {post.boardName}
              </Link>
              <span>&middot;</span>
              <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              {post.userLocation && (
                <>
                  <span>&middot;</span>
                  <span>{post.userLocation}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <PostImages images={post.images || []} />

        <div
          className="mt-4 text-sm text-gray-800 dark:text-gray-200 break-words prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: linkifyHtml(post.body) }}
        />

        <div className="mt-4 border-t border-gray-100 dark:border-gray-800 pt-3">
          <ReactionBar
            targetType="post"
            targetId={post.id}
            reactionCount={post.reactionCount}
          />
        </div>
      </div>

      {/* Comment form */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          {comments.length > 0 ? `${comments.length} Comments` : 'Comments'}
        </h3>
        <CommentForm postUuid={uuid} onCommentAdded={fetchComments} />
      </div>

      {/* Comments */}
      {comments.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          <CommentThread
            comments={comments}
            postUuid={uuid}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onRefresh={fetchComments}
          />
        </div>
      )}
    </div>
  )
}
