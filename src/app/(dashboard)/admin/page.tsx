import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, releases, company, partners } from '@/db/schema'
import { count, eq, desc, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, FileText, Building2, Briefcase, Settings, Package, Mail, ListChecks } from 'lucide-react'
import { PRLookup } from './pr-lookup'
import { SalesStats } from './sales-stats'

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
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500">Manage users, content, and settings</p>
      </div>

      {/* PR Lookup */}
      <div data-tour="admin-pr-lookup">
        <PRLookup />
      </div>

      {/* Sales Stats */}
      <div data-tour="admin-sales-stats">
        <SalesStats />
      </div>

      {/* Stats */}
      <div data-tour="admin-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-tour="admin-stat-users">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.users}</p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-tour="admin-stat-releases">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.releases}</p>
                <p className="text-sm text-gray-500">Releases</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-tour="admin-stat-companies">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.companies}</p>
                <p className="text-sm text-gray-500">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-tour="admin-stat-partners">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.partners}</p>
                <p className="text-sm text-gray-500">Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card data-tour="admin-quick-actions">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/users" data-tour="admin-action-users">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users className="h-6 w-6" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/releases" data-tour="admin-action-releases">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <FileText className="h-6 w-6" />
                All Releases
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
            <Link href="/editorial/queue" data-tour="admin-action-review-queue">
              <Button variant="outline" className="w-full h-20 flex-col gap-2 relative">
                <FileText className="h-6 w-6" />
                Review Queue
                {stats.pendingReleases > 0 && (
                  <Badge className="absolute top-2 right-2 bg-red-500 text-white">{stats.pendingReleases}</Badge>
                )}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Pending Items */}
      {stats.pendingReleases > 0 && (
        <Card data-tour="admin-pending-review" className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-yellow-900">
                  {stats.pendingReleases} release{stats.pendingReleases !== 1 ? 's' : ''} pending review
                </h3>
                <p className="text-sm text-yellow-700">
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
