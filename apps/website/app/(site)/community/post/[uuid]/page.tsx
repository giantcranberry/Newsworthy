import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Heart } from 'lucide-react'
import { getPostByUuid, getCommentsByPostId } from '@/lib/community'
import { PostImages } from '@/components/community/post-images'
import { RegisterCTA } from '@/components/community/register-cta'
import { RegisterBanner } from '@/components/community/register-banner'
import { linkifyHtml } from '@/lib/linkify-html'
import { Avatar } from '@/components/community/avatar'

export const revalidate = 120

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

export async function generateMetadata({ params }: { params: Promise<{ uuid: string }> }): Promise<Metadata> {
  const { uuid } = await params
  const post = await getPostByUuid(uuid)
  if (!post) return {}

  const plainText = stripHtml(post.body)
  const description = plainText.length > 160 ? plainText.slice(0, 157) + '...' : plainText

  return {
    title: `${post.userName} in ${post.boardName} - Community`,
    description,
    openGraph: {
      title: `${post.userName} in ${post.boardName} | Newsworthy.ai Community`,
      description,
      type: 'article',
      publishedTime: post.createdAt.toISOString(),
      authors: [post.userName],
    },
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
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

export default async function PostDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const post = await getPostByUuid(uuid)
  if (!post) notFound()

  const [comments] = await Promise.all([
    getCommentsByPostId(post.id),
  ])

  const plainText = stripHtml(post.body)

  // Build threaded comments: top-level + replies grouped by parentId
  const topLevel = comments.filter(c => !c.parentId)
  const repliesByParent = new Map<number, typeof comments>()
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) || []
      list.push(c)
      repliesByParent.set(c.parentId, list)
    }
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: `${post.userName} in ${post.boardName}`,
    text: plainText.slice(0, 500),
    author: { '@type': 'Person', name: post.userName },
    datePublished: post.createdAt.toISOString(),
    interactionStatistic: [
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/CommentAction', userInteractionCount: post.commentCount },
      { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: post.reactionCount },
    ],
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 lg:px-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <Link href={`/community/board/${post.boardSlug}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-cyan-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to {post.boardName}
      </Link>

      <article>
        {/* Author header */}
        <div className="flex items-center gap-3 mb-6">
          <Avatar name={post.userName} avatar={post.userAvatar} emailHash={post.userEmailHash} size="lg" />
          <div>
            <span className="font-medium text-gray-900">{post.userName}</span>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Link href={`/community/board/${post.boardSlug}`} className="hover:underline" style={{ color: post.boardColor }}>
                {post.boardName}
              </Link>
              <span>&middot;</span>
              <time dateTime={post.createdAt.toISOString()}>{formatDate(new Date(post.createdAt))}</time>
            </div>
          </div>
        </div>

        {/* Post body */}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: linkifyHtml(post.body) }}
        />

        {/* Images */}
        <PostImages images={post.images} />

        {/* Stats */}
        <div className="mt-6 flex items-center gap-4 border-t border-gray-100 pt-4 text-sm text-gray-400">
          {post.reactionCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Heart className="h-4 w-4" /> {post.reactionCount} reactions
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-4 w-4" /> {post.commentCount} comments
          </span>
        </div>
      </article>

      {/* Comments section */}
      {comments.length > 0 && (
        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
          </h2>
          <div className="space-y-3">
            {topLevel.map((comment) => (
              <CommentNode
                key={comment.id}
                comment={comment}
                replies={repliesByParent}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA to join */}
      <div className="mt-8">
        <RegisterCTA action="join the conversation" />
      </div>

      <RegisterBanner />
    </div>
  )
}

function CommentNode({
  comment,
  replies,
}: {
  comment: {
    id: number
    body: string
    depth: number
    userName: string
    userAvatar: string | null
    userEmailHash: string | null
    createdAt: Date
  }
  replies: Map<number, any[]>
}) {
  const childComments = replies.get(comment.id) || []

  return (
    <div className={comment.depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <Avatar name={comment.userName} avatar={comment.userAvatar} emailHash={comment.userEmailHash} size="sm" />
          <span className="text-sm font-medium text-gray-900">{comment.userName}</span>
          <span className="text-xs text-gray-400">{getTimeAgo(new Date(comment.createdAt))}</span>
        </div>
        <div
          className="text-sm text-gray-700 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: linkifyHtml(comment.body) }}
        />
      </div>
      {childComments.length > 0 && (
        <div className="mt-2 space-y-2">
          {childComments.map((child: any) => (
            <CommentNode key={child.id} comment={child} replies={replies} />
          ))}
        </div>
      )}
    </div>
  )
}
