import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, company, users } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Clock } from 'lucide-react'
import { QueueList } from './queue-list'

async function getQueueItems() {
  const items = await db
    .select({
      queue: queue,
      release: releases,
      company: company,
      user: users,
    })
    .from(queue)
    .innerJoin(releases, eq(queue.releaseId, releases.id))
    .innerJoin(company, eq(releases.companyId, company.id))
    .innerJoin(users, eq(releases.userId, users.id))
    .where(
      eq(releases.status, 'review')
    )
    .orderBy(asc(releases.releaseAt))

  return items
}

export default async function EditorialQueuePage() {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    redirect('/dashboard')
  }

  const queueItems = await getQueueItems()
  const currentUserId = parseInt(session?.user?.id || '0')
  const currentUserName = session?.user?.name || session?.user?.email || 'Editor'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editorial Queue</h1>
          <p className="text-gray-600">Press releases pending editorial review</p>
        </div>
        <div className="flex items-center gap-2">
          <span data-tour="queue-pending-count" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4" />
            {queueItems.length} pending
          </span>
        </div>
      </div>

      {queueItems.length === 0 ? (
        <Card data-tour="queue-empty">
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="mt-2 text-gray-600">No press releases pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <QueueList
          items={queueItems.map((item) => ({
            queueId: item.queue.id,
            queueUuid: item.queue.uuid,
            releaseId: item.release.id,
            releaseUuid: item.release.uuid,
            title: item.release.title,
            abstract: item.release.abstract,
            distribution: item.release.distribution,
            companyName: item.company.companyName,
            userEmail: item.user.email,
            submitted: item.queue.submitted?.toISOString() ?? null,
            releaseAt: item.release.releaseAt?.toISOString() ?? null,
            timezone: item.release.timezone,
            checkedout: item.queue.checkedout?.toISOString() ?? null,
            editorId: item.queue.editorId,
            editorName: item.queue.editorName,
          }))}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}
    </div>
  )
}
