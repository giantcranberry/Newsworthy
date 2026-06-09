import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { consolidatedReports } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { SharedReportsList } from './shared-list'

export default async function SharedReportsPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) return <p>Unauthorized</p>

  const rows = await db.query.consolidatedReports.findMany({
    where: and(eq(consolidatedReports.userId, userId), eq(consolidatedReports.isDeleted, false)),
    orderBy: desc(consolidatedReports.createdAt),
  })

  const shares = rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    count: Array.isArray(r.releaseUuids) ? (r.releaseUuids as string[]).length : 0,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Shared Reports</h1>
          <p className="text-gray-600 dark:text-gray-400">Public consolidated reports you&apos;ve shared</p>
        </div>
        <Link href="/pr/reports">
          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Reports
          </Button>
        </Link>
      </div>

      <SharedReportsList shares={shares} />
    </div>
  )
}
