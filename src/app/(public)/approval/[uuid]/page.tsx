import { db } from '@/db'
import { approvals, releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ApprovalResponse } from './approval-response'

async function getApprovalWithRelease(approvalUuid: string) {
  const approval = await db.query.approvals.findFirst({
    where: eq(approvals.uuid, approvalUuid),
  })

  if (!approval) {
    return null
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, approval.releaseId),
    with: {
      company: true,
      banner: true,
    },
  })

  return { approval, release }
}

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params

  const data = await getApprovalWithRelease(uuid)

  if (!data || !data.release) {
    notFound()
  }

  const { approval, release } = data

  // If already signed, show appropriate message
  if (approval.signedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            {approval.approved ? (
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {approval.approved ? 'Already Approved' : 'Already Responded'}
          </h1>
          <p className="text-gray-600">
            {approval.approved
              ? 'This press release has already been approved. No further action is required.'
              : 'A response has already been submitted for this approval request.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ApprovalResponse
      approvalUuid={approval.uuid}
      release={{
        title: release.title || 'Untitled Press Release',
        abstract: release.abstract || '',
        body: release.body || '',
        location: release.location || '',
      }}
      company={{
        name: release.company?.companyName || '',
        logoUrl: release.company?.logoUrl || null,
      }}
      banner={release.banner ? { url: release.banner.url, caption: release.banner.caption } : null}
      approverName={approval.emailTo || ''}
      notes={approval.notes || null}
    />
  )
}
