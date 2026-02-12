import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, company, users } from '@/db/schema'
import { eq, isNull, desc, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Clock, CheckCircle, User } from 'lucide-react'

async function getQueueItems() {
  // Get pending items (not approved, not returned)
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
      and(
        isNull(queue.approved),
        eq(releases.status, 'editorial')
      )
    )
    .orderBy(desc(queue.submitted))

  return items
}

export default async function EditorialQueuePage() {
  const session = await auth()

  // Check if user has editorial access
  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isEditor && !isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const queueItems = await getQueueItems()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editorial Queue</h1>
          <p className="text-gray-500">Review pending press releases</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {queueItems.length} pending
          </span>
        </div>
      </div>

      {/* Queue List */}
      {queueItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="mt-2 text-gray-500">No press releases pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queueItems.map((item) => (
            <Card key={item.queue.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        Pending Review
                      </span>
                      {item.queue.editorId && (
                        <span className="text-xs text-gray-500">
                          Checked out by {item.queue.editorName}
                        </span>
                      )}
                    </div>
                    <Link href={`/editorial/review/${item.release.uuid}`}>
                      <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                        {item.release.title || 'Untitled Release'}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">
                      {item.company.companyName}
                    </p>
                    {item.release.abstract && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {item.release.abstract}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.user.email}
                      </span>
                      <span>
                        Submitted: {item.queue.submitted ? new Date(item.queue.submitted).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/editorial/review/${item.release.uuid}`}>
                      <Button>Review</Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
