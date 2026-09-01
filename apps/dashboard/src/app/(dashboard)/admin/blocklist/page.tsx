import { auth } from '@/lib/auth'
import { db } from '@/db'
import { blocklistTerms } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { BlocklistManager } from './blocklist-manager'

export default async function AdminBlocklistPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const terms = await db
    .select()
    .from(blocklistTerms)
    .orderBy(asc(blocklistTerms.term))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Block List
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage keywords and phrases for a content block list. Stored only —
          not enforced yet.
        </p>
      </div>

      <BlocklistManager initialTerms={terms} />
    </div>
  )
}
