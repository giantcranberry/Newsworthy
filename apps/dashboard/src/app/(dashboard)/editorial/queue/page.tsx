import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, company, users, userSubscription, blocklistTerms } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Clock } from 'lucide-react'
import { QueueList } from './queue-list'
import { findBlockedTerms } from '@/lib/blocklist'

async function getQueueItems() {
  const items = await db
    .select({
      queue: queue,
      release: releases,
      company: company,
      user: users,
      subscriptionStartAt: userSubscription.startAt,
    })
    .from(queue)
    .innerJoin(releases, eq(queue.releaseId, releases.id))
    .innerJoin(company, eq(releases.companyId, company.id))
    .innerJoin(users, eq(releases.userId, users.id))
    .leftJoin(userSubscription, eq(userSubscription.userId, users.id))
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

  const [queueItems, blocklist] = await Promise.all([
    getQueueItems(),
    db.select({ term: blocklistTerms.term }).from(blocklistTerms),
  ])
  const blockTerms = blocklist.map((row) => row.term)
  const currentUserId = parseInt(session?.user?.id || '0')
  const currentUserName = session?.user?.name || session?.user?.email || 'Editor'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Editorial Queue</h1>
          <p className="text-gray-600 dark:text-gray-400">Press releases pending editorial review</p>
        </div>
        <div className="flex items-center gap-2">
          <span data-tour="queue-pending-count" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            <Clock className="h-4 w-4" />
            {queueItems.length} pending
          </span>
        </div>
      </div>

      {queueItems.length === 0 ? (
        <Card data-tour="queue-empty">
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">All caught up!</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">No press releases pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <QueueList
          items={queueItems.map((item) => {
            // created_at is null for some accounts; fall back to subscription start
            const registeredAt =
              item.user.createdAt ?? item.subscriptionStartAt ?? null
            return {
              queueId: item.queue.id,
              queueUuid: item.queue.uuid,
              releaseId: item.release.id,
              releaseUuid: item.release.uuid,
              title: item.release.title,
              abstract: item.release.abstract,
              distribution: item.release.distribution,
              companyName: item.company.companyName,
              userEmail: item.user.email,
              registeredAt: registeredAt?.toISOString() ?? null,
              submitted: item.queue.submitted?.toISOString() ?? null,
              releaseAt: item.release.releaseAt?.toISOString() ?? null,
              timezone: item.release.timezone,
              checkedout: item.queue.checkedout?.toISOString() ?? null,
              editorId: item.queue.editorId,
              editorName: item.queue.editorName,
              blockedTerms: findBlockedTerms(
                {
                  title: item.release.title,
                  abstract: item.release.abstract,
                  body: item.release.body,
                  pullquote: item.release.pullquote,
                  location: item.release.location,
                },
                blockTerms,
              ),
            }
          })}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}
    </div>
  )
}
