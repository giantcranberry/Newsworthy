import { db } from '@/db'
import { approvals, releases, releaseImages, releaseFiles } from '@/db/schema'
import { and, asc, desc, eq, lte, ne } from 'drizzle-orm'
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
      // Everything below mirrors what the public article page renders
      primaryContact: true,
      releaseFiles: {
        orderBy: [asc(releaseFiles.sortOrder)],
        with: { file: true },
      },
      faqs: true,
      releaseCategories: { with: { category: true } },
    },
  })

  if (!release) return { approval, release: null, recent: [] }

  // "Other Recent News" uses the same query as the article page
  const recent = await db.query.releases.findMany({
    limit: 5,
    columns: { title: true },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.companyId, release.companyId),
      ne(releases.id, release.id),
      lte(releases.releasedAt, new Date()),
    ),
    orderBy: desc(releases.releasedAt),
  })

  return { approval, release, recent }
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

  const { approval, release, recent } = data

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
            {approval.withChanges ? 'Already Approved with Changes' : approval.approved ? 'Already Approved' : 'Already Responded'}
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
      company={{
        name: release.company?.companyName || '',
        logoUrl: release.company?.logoUrl || null,
      }}
      preview={{
        release: {
          title: release.title || 'Untitled Press Release',
          abstract: release.abstract || '',
          body: release.body || '',
          location: release.location || '',
          pullquote: release.pullquote || null,
          videoUrl: release.videoUrl || null,
          landingPage: release.landingPage || null,
          publicDrive: release.publicDrive || null,
          releaseAt: release.releaseAt?.toISOString() ?? null,
          timezone: release.timezone || null,
        },
        company: {
          name: release.company?.companyName || '',
          logoUrl: release.company?.logoUrl || null,
          website: release.company?.website || null,
          phone: release.company?.phone || null,
          nrUri: release.company?.nrUri || null,
          uuid: release.company?.uuid || null,
          linkedinUrl: release.company?.linkedinUrl || null,
          xUrl: release.company?.xUrl || null,
          facebookUrl: release.company?.facebookUrl || null,
          instagramUrl: release.company?.instagramUrl || null,
          youtubeUrl: release.company?.youtubeUrl || null,
        },
        contact: release.primaryContact
          ? {
              name: release.primaryContact.name,
              title: release.primaryContact.title || null,
              hasEmail: !!release.primaryContact.email,
              phone: release.primaryContact.phone || null,
              avatar: release.primaryContact.avatar || null,
            }
          : null,
        bannerUrl: release.banner?.url || null,
        images: (() => {
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
        })(),
        files: (release.releaseFiles || [])
          .filter((rf) => rf.file && !rf.file.isDeleted)
          .map((rf) => ({
            id: rf.file.id,
            title: rf.file.title,
            description: rf.file.description || null,
            filename: rf.file.filename || null,
            url: rf.file.url,
            mimeType: rf.file.mimeType || null,
            filesize: rf.file.filesize || null,
            source: rf.file.source || null,
          })),
        faqs: [...(release.faqs || [])]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((f) => ({ question: f.question, answer: f.answer })),
        categories: (release.releaseCategories || [])
          .map((rc) => rc.category?.name)
          .filter((name): name is string => !!name),
        recentTitles: recent.map((r) => r.title || '').filter(Boolean),
      }}
      approverName={approval.emailTo || ''}
      notes={approval.notes || null}
    />
  )
}
