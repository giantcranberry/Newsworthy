import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, releases, company, partners } from '@/db/schema'
import { count, eq, desc, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, Briefcase, Package, Mail, ListChecks } from 'lucide-react'
import { PRLookup } from './pr-lookup'
import { SalesStats } from './sales-stats'
import { AdminStats } from './admin-stats'

function GoogleAnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M18.5 2.25A3.25 3.25 0 0 0 15.25 5.5v13a3.25 3.25 0 1 0 6.5 0v-13A3.25 3.25 0 0 0 18.5 2.25Z"
        fill="#F9AB00"
      />
      <path
        d="M9.75 9.5A3.25 3.25 0 0 0 6.5 12.75v5.75a3.25 3.25 0 1 0 6.5 0v-5.75A3.25 3.25 0 0 0 9.75 9.5Z"
        fill="#E37400"
      />
      <circle cx="3.25" cy="18.5" r="3.25" fill="#E37400" />
    </svg>
  )
}

async function getAdminStats() {
  const [userCount] = await db.select({ count: count() }).from(users)
  const [releaseCount] = await db.select({ count: count() }).from(releases)
  const [companyCount] = await db.select({ count: count() }).from(company)
  const [partnerCount] = await db.select({ count: count() }).from(partners)

  // Get recent releases awaiting review
  const pendingReleases = await db
    .select({ count: count() })
    .from(releases)
    .where(eq(releases.status, 'review'))

  return {
    users: userCount.count,
    releases: releaseCount.count,
    companies: companyCount.count,
    partners: partnerCount.count,
    pendingReleases: pendingReleases[0].count,
  }
}

export default async function AdminPage() {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const stats = await getAdminStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage users, content, and settings</p>
      </div>

      {/* PR Lookup */}
      <div data-tour="admin-pr-lookup">
        <PRLookup isAdmin={!!isAdmin} />
      </div>

      {/* Quick Actions */}
      <Card data-tour="admin-quick-actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isAdmin && (
              <Link href="/admin/analytics" data-tour="admin-action-analytics">
                <Button
                  variant="outline"
                  className="w-full h-20 flex-col gap-2 border-orange-200 text-orange-900 hover:bg-orange-50 hover:border-orange-300 dark:border-orange-900/60 dark:text-orange-100 dark:hover:bg-orange-950/40 dark:hover:border-orange-800"
                >
                  <GoogleAnalyticsIcon className="h-6 w-6" />
                  Google Analytics
                </Button>
              </Link>
            )}
            <Link href="/admin/users" data-tour="admin-action-users">
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-2 border-blue-200 text-blue-900 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-900/60 dark:text-blue-100 dark:hover:bg-blue-950/40 dark:hover:border-blue-800"
              >
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                Manage Users
              </Button>
            </Link>
            <Link href="/editorial/queue" data-tour="admin-action-review-queue">
              <Button
                variant="outline"
                className="w-full h-20 flex-col gap-2 relative border-green-200 text-green-900 hover:bg-green-50 hover:border-green-300 dark:border-green-900/60 dark:text-green-100 dark:hover:bg-green-950/40 dark:hover:border-green-800"
              >
                <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                Review Queue
                {stats.pendingReleases > 0 && (
                  <Badge className="absolute top-2 right-2 bg-red-500 text-white">{stats.pendingReleases}</Badge>
                )}
              </Button>
            </Link>
            <Link href="/admin/partners" data-tour="admin-action-partners">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Briefcase className="h-6 w-6" />
                Partners
              </Button>
            </Link>
            <Link href="/admin/products" data-tour="admin-action-products">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Package className="h-6 w-6" />
                Products
              </Button>
            </Link>
            <Link href="/admin/messages" data-tour="admin-action-messages">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Mail className="h-6 w-6" />
                Messages
              </Button>
            </Link>
            <Link href="/admin/tasks" data-tour="admin-action-tasks">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <ListChecks className="h-6 w-6" />
                Tasks
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Sales Stats */}
      <div data-tour="admin-sales-stats">
        <SalesStats />
      </div>

      {/* Stats */}
      <AdminStats
        users={stats.users}
        releases={stats.releases}
        companies={stats.companies}
        partners={stats.partners}
      />

      {/* Pending Items */}
      {stats.pendingReleases > 0 && (
        <Card data-tour="admin-pending-review" className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-yellow-900">
                  {stats.pendingReleases} release{stats.pendingReleases !== 1 ? 's' : ''} pending review
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Press releases are waiting for editorial approval
                </p>
              </div>
              <Link href="/editorial/queue">
                <Button className="bg-amber-900 hover:bg-amber-950 text-white">Review Now</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
