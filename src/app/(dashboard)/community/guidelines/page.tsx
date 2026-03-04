import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityGuidelines } from '@/db/schema'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MarkdownBody } from './markdown-body'

export default async function GuidelinesPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [guidelines] = await db.select().from(communityGuidelines).limit(1)

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Community Guidelines</h1>
        <p className="text-gray-600 dark:text-gray-400">Please follow these guidelines when participating in the community</p>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6">
        {guidelines?.body ? (
          <MarkdownBody content={guidelines.body} />
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No guidelines have been published yet.</p>
        )}
      </div>
    </div>
  )
}
