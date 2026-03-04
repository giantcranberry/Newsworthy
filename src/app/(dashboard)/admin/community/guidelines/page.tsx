import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityGuidelines } from '@/db/schema'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { GuidelinesEditor } from '@/components/admin/community/guidelines-editor'

export default async function AdminGuidelinesPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) redirect('/dashboard')

  const [guidelines] = await db.select().from(communityGuidelines).limit(1)

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
        <h1 className="text-2xl font-bold text-gray-900">Community Guidelines</h1>
        <p className="text-gray-600">Edit the community rules and guidelines (Markdown supported)</p>
      </div>

      <GuidelinesEditor initialBody={guidelines?.body || ''} />
    </div>
  )
}
