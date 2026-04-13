import { db } from '@/db'
import { approvals, releases, releaseImages } from '@/db/schema'
import { asc, eq } from 'drizzle-orm'
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
      primaryImage: true,
      releaseImages: {
        orderBy: [asc(releaseImages.sortOrder)],
        with: { image: true },
      },
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg shadow-lg p-8 text-center">
          <div className="mb-4">
            {approval.approved ? (
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {approval.approved ? 'Already Approved' : 'Already Responded'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
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
        pullquote: release.pullquote || null,
      }}
      company={{
        name: release.company?.companyName || '',
        logoUrl: release.company?.logoUrl || null,
      }}
      banner={release.banner ? { url: release.banner.url, caption: release.banner.caption } : null}
      carouselImages={(() => {
        const fromRelease = (release.releaseImages || [])
          .filter((ri) => ri.image)
          .map((ri) => ({
            id: ri.image!.id,
            url: ri.image!.url.replace('RESIZE/', ''),
            title: ri.image!.title,
            caption: ri.image!.caption,
            imgCredits: ri.image!.imgCredits,
          }))
        if (fromRelease.length > 0) return fromRelease
        if (release.primaryImage?.url) {
          return [{
            id: 0,
            url: release.primaryImage.url.replace('RESIZE/', ''),
            title: null,
            caption: release.primaryImage.caption ?? null,
            imgCredits: release.primaryImage.imgCredits ?? null,
          }]
        }
        return []
      })()}
      approverName={approval.emailTo || ''}
      notes={approval.notes || null}
    />
  )
}
