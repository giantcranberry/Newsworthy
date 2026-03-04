import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function AdminCommunityPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <p className="text-gray-600">Manage community boards and guidelines</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/admin/community/boards" className="block">
          <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-cyan-300 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-2">
              <i className="fa-light fa-table-columns text-xl text-cyan-800" />
              <h2 className="text-lg font-semibold text-gray-900">Boards</h2>
            </div>
            <p className="text-sm text-gray-600">Create and manage discussion boards for the community.</p>
          </div>
        </Link>

        <Link href="/admin/community/guidelines" className="block">
          <div className="rounded-lg border border-gray-200 bg-white p-6 hover:border-cyan-300 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-2">
              <i className="fa-light fa-book text-xl text-cyan-800" />
              <h2 className="text-lg font-semibold text-gray-900">Guidelines</h2>
            </div>
            <p className="text-sm text-gray-600">Edit community guidelines and rules of conduct.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
