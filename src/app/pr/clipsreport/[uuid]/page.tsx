'use client'

import { use } from 'react'
import { ClipsReport } from '@/app/(dashboard)/pr/clips/[uuid]/clips-report'

export default function PublicClipsReportPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = use(params)
  return <ClipsReport uuid={uuid} isPublic={true} />
}
