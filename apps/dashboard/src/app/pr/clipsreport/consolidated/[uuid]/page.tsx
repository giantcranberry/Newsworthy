import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { db } from '@/db'
import { consolidatedReports } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { ConsolidatedReport } from '@/app/(dashboard)/pr/reports/consolidated/consolidated-report'

export default async function PublicConsolidatedReportPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params

  const record = await db.query.consolidatedReports.findFirst({
    where: and(eq(consolidatedReports.uuid, uuid), eq(consolidatedReports.isDeleted, false)),
  })

  if (!record) notFound()

  const releaseUuids = Array.isArray(record.releaseUuids) ? (record.releaseUuids as string[]) : []

  return (
    <Suspense fallback={<div className="py-32 text-center text-gray-400">Loading…</div>}>
      <ConsolidatedReport isPublic releaseUuids={releaseUuids} title={record.title} />
    </Suspense>
  )
}
