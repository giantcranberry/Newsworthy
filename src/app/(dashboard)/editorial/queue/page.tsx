import { auth } from '@/lib/auth'
import { db } from '@/db'
import { queue, releases, company, users } from '@/db/schema'
import { eq, isNull, desc, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, CheckCircle, User, Eye } from 'lucide-react'

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
          <p className="text-gray-600">Review pending press releases</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-4 w-4" />
            {queueItems.length} pending
          </span>
        </div>
      </div>

      {/* Queue List */}
      {queueItems.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="mt-2 text-gray-600">No press releases pending review.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {queueItems.map((item) => (
            <Card key={item.queue.id} className="overflow-hidden">
              <div className="flex-1 min-w-0 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                          Pending Review
                        </span>
                        {item.queue.editorId && (
                          <span className="text-xs text-gray-600">
                            Checked out by {item.queue.editorName}
                          </span>
                        )}
                      </div>
                      <Link href={`/editorial/review/${item.release.uuid}`} className="cursor-pointer">
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-cyan-800 truncate">
                          {item.release.title || 'Untitled Release'}
                        </h3>
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">
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
                          Submitted: {item.queue.submitted ? new Date(item.queue.submitted).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Link href={`/editorial/review/${item.release.uuid}`}>
                        <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium bg-cyan-800 text-white cursor-pointer transition-colors hover:bg-cyan-900">
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </button>
                      </Link>
                    </div>
                  </div>
                </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
