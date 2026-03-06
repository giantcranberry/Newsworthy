import { getEffectiveSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PostDetail } from './post-detail'

export default async function PostPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')

  const { uuid } = await params

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-40">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <PostDetail
        uuid={uuid}
        currentUserId={userId}
        isAdmin={(session?.user as any)?.isAdmin}
      />
    </div>
  )
}
