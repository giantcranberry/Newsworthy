import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, users, company } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Eye, ExternalLink } from 'lucide-react'

async function getReleases() {
  const allReleases = await db
    .select({
      release: releases,
      user: users,
      company: company,
    })
    .from(releases)
    .leftJoin(users, eq(releases.userId, users.id))
    .leftJoin(company, eq(releases.companyId, company.id))
    .orderBy(desc(releases.createdAt))
    .limit(100)

  return allReleases
}

const statusColors: Record<string, string> = {
  start: 'bg-gray-100 text-gray-700',
  draft: 'bg-yellow-100 text-yellow-700',
  review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  released: 'bg-purple-100 text-purple-700',
}

export default async function AdminReleasesPage() {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const allReleases = await getReleases()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Releases</h1>
          <p className="text-gray-500">View and manage all press releases</p>
        </div>
      </div>

      {/* Releases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Press Releases ({allReleases.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 px-4 font-medium text-gray-500">ID</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Title</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Company</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Author</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Created</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allReleases.map(({ release, user, company: comp }) => (
                  <tr key={release.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{release.id}</td>
                    <td className="py-3 px-4 text-sm max-w-xs truncate">
                      {release.title || 'Untitled'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {comp?.companyName || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {user?.email || 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[release.status || 'start'] || statusColors.start}`}>
                        {release.status || 'start'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {release.createdAt ? new Date(release.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Link href={`/pr/${release.uuid}`}>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {release.status === 'editorial' && (
                          <Link href={`/editorial/review/${release.uuid}`}>
                            <Button size="sm">Review</Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
