import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, users, company } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ReleasesTable } from './releases-table'

async function getReleases() {
  const allReleases = await db
    .select({
      release: {
        id: releases.id,
        uuid: releases.uuid,
        title: releases.title,
        status: releases.status,
        createdAt: releases.createdAt,
        releaseAt: releases.releaseAt,
      },
      user: {
        email: users.email,
      },
      company: {
        companyName: company.companyName,
      },
    })
    .from(releases)
    .leftJoin(users, eq(releases.userId, users.id))
    .leftJoin(company, eq(releases.companyId, company.id))
    .orderBy(desc(releases.createdAt))
    .limit(200)

  return allReleases
}

export default async function AdminReleasesPage() {
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const allReleases = await getReleases()

  return (
    <div className="space-y-6">
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

      <ReleasesTable releases={allReleases} />
    </div>
  )
}
