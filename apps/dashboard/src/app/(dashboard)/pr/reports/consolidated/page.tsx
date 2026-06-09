import { getEffectiveSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ConsolidatedReport } from './consolidated-report'

export default async function ConsolidatedReportPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) redirect('/login')

  // `ids` is read client-side from the live URL (useSearchParams) so client
  // navigation always sees the current selection. Per-release access is enforced
  // by the /api/pr/[uuid]/report endpoint each one is fetched from.
  return (
    <Suspense fallback={<div className="py-32 text-center text-gray-400">Loading…</div>}>
      <ConsolidatedReport />
    </Suspense>
  )
}
