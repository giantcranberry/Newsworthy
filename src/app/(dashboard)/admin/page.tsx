import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, releases, company, partners } from '@/db/schema'
import { count, eq, desc, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, FileText, Building2, Briefcase, Settings, Package } from 'lucide-react'

async function getAdminStats() {
  const [userCount] = await db.select({ count: count() }).from(users)
  const [releaseCount] = await db.select({ count: count() }).from(releases)
  const [companyCount] = await db.select({ count: count() }).from(company)
  const [partnerCount] = await db.select({ count: count() }).from(partners)

  // Get recent releases awaiting review
  const pendingReleases = await db
    .select({ count: count() })
    .from(releases)
    .where(eq(releases.status, 'editorial'))

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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.users}</p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.releases}</p>
                <p className="text-sm text-gray-500">Releases</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.companies}</p>
                <p className="text-sm text-gray-500">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <Briefcase className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.partners}</p>
                <p className="text-sm text-gray-500">Partners</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/admin/users">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Users className="h-6 w-6" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/releases">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <FileText className="h-6 w-6" />
                All Releases
              </Button>
            </Link>
            <Link href="/admin/partners">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Briefcase className="h-6 w-6" />
                Partners
              </Button>
            </Link>
            <Link href="/admin/products">
              <Button variant="outline" className="w-full h-20 flex-col gap-2">
                <Package className="h-6 w-6" />
                Products
              </Button>
            </Link>
            <Link href="/editorial/queue">
              <Button variant="outline" className="w-full h-20 flex-col gap-2 relative">
                <FileText className="h-6 w-6" />
                Review Queue
                {stats.pendingReleases > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {stats.pendingReleases}
                  </span>
                )}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Pending Items */}
      {stats.pendingReleases > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
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
                <Button>Review Now</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
