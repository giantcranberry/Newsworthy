import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReleasedEditLookup } from './released-edit-lookup'

export default async function ReleasedEditPage() {
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Released Press Release</h1>
        <p className="text-gray-600 dark:text-gray-400">Look up a released press release by ID to edit its content</p>
      </div>

      <ReleasedEditLookup />
    </div>
  )
}
