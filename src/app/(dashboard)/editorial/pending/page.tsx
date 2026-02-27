import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'
import { PendingList } from './pending-list'

async function getPendingReleases() {
  const items = await db
    .select()
    .from(releases)
    .where(eq(releases.status, 'approved'))
    .orderBy(asc(releases.approvedAt))

  return items
}

export default async function PendingPage() {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    redirect('/dashboard')
  }

  const items = await getPendingReleases()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approved &mdash; Pending Release</h1>
        <p className="text-gray-600">Press releases approved and waiting for distribution</p>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No pending releases</h3>
            <p className="mt-2 text-gray-600">All approved releases have been distributed.</p>
          </CardContent>
        </Card>
      ) : (
        <PendingList
          items={items.map((item) => ({
            id: item.id,
            uuid: item.uuid,
            title: item.title,
            distribution: item.distribution,
            releaseAt: item.releaseAt?.toISOString() ?? null,
            timezone: item.timezone,
          }))}
        />
      )}
    </div>
  )
}
