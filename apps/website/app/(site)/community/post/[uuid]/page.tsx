import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Heart } from 'lucide-react'
import { getPostByUuid } from '@/lib/community'
import { PostImages } from '@/components/community/post-images'
import { RegisterCTA } from '@/components/community/register-cta'
import { RegisterBanner } from '@/components/community/register-banner'

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

export default async function PostDetailPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params
  const post = await getPostByUuid(uuid)
  if (!post) notFound()

  const plainText = stripHtml(post.body)

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
          {post.userAvatar ? (
            <img src={post.userAvatar} alt={post.userName} className="h-12 w-12 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
              {getInitials(post.userName)}
            </div>
          )}
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

        {/* Post body - trusted HTML from authenticated TinyMCE input */}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.body }}
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

      {/* CTA in place of comments */}
      <div className="mt-8">
        <RegisterCTA action="comment on this post" />
      </div>

      <RegisterBanner />
    </div>
  )
}
