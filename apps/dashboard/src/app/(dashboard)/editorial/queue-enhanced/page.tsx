import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseEnhanced } from '@/db/schema'
import { eq, or, and, isNull, ne, desc } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle } from 'lucide-react'
import { EnhancedQueueList } from './enhanced-queue-list'

async function getEnhancedQueueItems() {
  // Get releases with enhanced/yahoo distribution that are missing report URLs
  const items = await db
    .select({
      release: releases,
      enhanced: releaseEnhanced,
    })
    .from(releases)
    .leftJoin(releaseEnhanced, eq(releases.id, releaseEnhanced.prid))
    .where(
      and(
        or(
          eq(releases.distribution, 'enhanced'),
          eq(releases.distribution, 'yahoo')
        ),
        ne(releases.distribution, 'standard'),
        or(
          isNull(releaseEnhanced.reportUrl),
          isNull(releaseEnhanced.id)
        )
      )
    )
    .orderBy(desc(releases.releasedAt))

  return items
}

export default async function EnhancedQueuePage() {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    redirect('/dashboard')
  }

  const items = await getEnhancedQueueItems()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Enhanced Distribution Queue</h1>
        <p className="text-gray-600 dark:text-gray-400">Press releases with enhanced distribution pending processing</p>
      </div>

      {items.length === 0 ? (
        <Card data-tour="enhanced-queue-empty">
          <CardContent className="py-16 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">All caught up!</h3>
            <p className="mt-2 text-gray-600 dark:text-gray-400">No releases in enhanced distribution queue.</p>
          </CardContent>
        </Card>
      ) : (
        <EnhancedQueueList
          items={items.map((item) => ({
            releaseId: item.release.id,
            releaseUuid: item.release.uuid,
            title: item.release.title,
            distribution: item.release.distribution,
            releasedAt: item.release.releasedAt?.toISOString() ?? null,
            enhancedId: item.enhanced?.id ?? null,
          }))}
        />
      )}
    </div>
  )
}
