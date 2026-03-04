import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BoardList } from '@/components/admin/community/board-list'

export default async function AdminBoardsPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) redirect('/dashboard')

  const boards = await db
    .select()
    .from(communityBoards)
    .where(eq(communityBoards.isDeleted, false))
    .orderBy(asc(communityBoards.sortOrder))

  return (
    <div className="space-y-6">
      <Link
        href="/admin/community"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Community Boards</h1>
        <p className="text-gray-600">Create and manage discussion boards</p>
      </div>

      <BoardList boards={boards} />
    </div>
  )
}
