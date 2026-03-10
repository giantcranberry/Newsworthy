import { Metadata } from 'next'
import { getBoards, getPublicPosts } from '@/lib/community'
import { BoardCard } from '@/components/community/board-card'
import { PublicPostCard } from '@/components/community/public-post-card'
import { RegisterCTA } from '@/components/community/register-cta'
import { RegisterBanner } from '@/components/community/register-banner'

export const revalidate = 120

export const metadata: Metadata = {
  title: 'Community',
  description: 'Join the Newsworthy.ai community — discuss PR strategies, share insights, and connect with fellow news marketers.',
  openGraph: {
    title: 'Community | Newsworthy.ai',
    description: 'Join the Newsworthy.ai community — discuss PR strategies, share insights, and connect with fellow news marketers.',
  },
}

export default async function CommunityPage() {
  const [boards, posts] = await Promise.all([
    getBoards(),
    getPublicPosts({ limit: 20 }),
  ])

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 lg:px-20">
      <div className="text-center prose prose-h1:mb-0 max-w-none mb-10">
        <h1 className="font-serif text-4xl font-semibold">Not Just a Newswire, A Community</h1>
        <p className="text-lg text-gray-600">
          Discussions, insights, and connections from the Newsworthy community.
        </p>
      </div>

      {/* Boards grid */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Boards</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      </section>

      {/* CTA to post */}
      <RegisterCTA action="start a discussion" />

      {/* Recent posts */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Posts</h2>
        <div className="space-y-4">
          {posts.map((post) => (
            <PublicPostCard key={post.uuid} post={post} />
          ))}
          {posts.length === 0 && (
            <p className="text-center text-gray-500 py-8">No posts yet. Be the first to start a discussion!</p>
          )}
        </div>
      </section>

      <RegisterBanner />
    </div>
  )
}
