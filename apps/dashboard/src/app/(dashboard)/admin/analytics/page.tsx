import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AnalyticsDashboard } from './analytics-dashboard'

export default async function AdminAnalyticsPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ← Admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Google Analytics across Newsworthy properties
          </p>
        </div>
      </div>

      <AnalyticsDashboard />
    </div>
  )
}
