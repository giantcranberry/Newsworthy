import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getBoardBySlug, getPublicPosts } from '@/lib/community'
import { PublicPostCard } from '@/components/community/public-post-card'
import { RegisterCTA } from '@/components/community/register-cta'
import { RegisterBanner } from '@/components/community/register-banner'

export const revalidate = 120

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const board = await getBoardBySlug(slug)
  if (!board) return {}
  return {
    title: `Community - ${board.name}`,
    description: board.description || `Browse discussions in the ${board.name} board on Newsworthy.ai.`,
    openGraph: {
      title: `Community - ${board.name} | Newsworthy.ai`,
      description: board.description || `Browse discussions in the ${board.name} board on Newsworthy.ai.`,
    },
  }
}

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const board = await getBoardBySlug(slug)
  if (!board) notFound()

  const posts = await getPublicPosts({ boardId: board.id, limit: 30 })

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-20">
      <Link href="/community" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-cyan-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: board.color + '20' }}
          >
            <i className={board.iconClass || 'fa-light fa-message'} style={{ color: board.color }} />
          </div>
          <h1 className="font-serif text-3xl font-semibold">{board.name}</h1>
        </div>
        {board.description && <p className="text-gray-600 mt-1">{board.description}</p>}
        {board.rules && (
          <div className="mt-4 rounded-md bg-gray-50 border border-gray-200 p-4 text-sm text-gray-600 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: board.rules }} />
        )}
      </div>

      <RegisterCTA action="post in this board" />

      <section className="mt-8">
        <div className="space-y-4">
          {posts.map((post) => (
            <PublicPostCard key={post.uuid} post={post} showBoard={false} />
          ))}
          {posts.length === 0 && (
            <p className="text-center text-gray-500 py-8">No posts in this board yet.</p>
          )}
        </div>
      </section>

      <RegisterBanner />
    </div>
  )
}
