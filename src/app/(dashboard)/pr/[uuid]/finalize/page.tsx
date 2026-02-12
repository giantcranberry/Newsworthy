import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, approvals } from '@/db/schema'
import { eq, and, asc, ne } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { FinalizeContent } from './finalize-content'
import { ApprovalSection } from './approval-section'

async function getReleaseWithDetails(uuid: string, userId: number) {
  const release = await db.query.releases.findFirst({
    where: and(
      eq(releases.uuid, uuid),
      eq(releases.userId, userId)
    ),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
      releaseImages: {
        orderBy: [asc(releaseImages.sortOrder)],
        with: { image: true },
      },
    },
  })

  return release
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

async function getApprovals(releaseId: number) {
  return db
    .select()
    .from(approvals)
    .where(eq(approvals.releaseId, releaseId))
    .orderBy(approvals.requestedAt)
}

async function getPriorApprovers(companyId: number, releaseId: number) {
  return db
    .selectDistinctOn([approvals.email], {
      email: approvals.email,
      emailTo: approvals.emailTo,
    })
    .from(approvals)
    .where(
      and(
        eq(approvals.companyId, companyId),
        ne(approvals.releaseId, releaseId)
      )
    )
}

export default async function FinalizePage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithDetails(uuid, userId)

  if (!release) {
    notFound()
  }

  const options = release.id ? await getReleaseOptions(release.id) : null
  const releaseApprovals = await getApprovals(release.id)
  const priorApprovers = await getPriorApprovers(release.companyId, release.id)

  // Serialize dates for client component
  const serializedApprovals = releaseApprovals.map((a) => ({
    ...a,
    requestedAt: a.requestedAt?.toISOString() ?? null,
    signedAt: a.signedAt?.toISOString() ?? null,
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finalize</h1>
        <p className="text-gray-500">
          Submit your press release for distribution
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={7}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
        banner={release.banner ? { url: release.banner.url, caption: release.banner.caption } : null}
        images={release.releaseImages?.map(ri => ({
          id: ri.image.id,
          url: ri.image.url,
          caption: ri.image.caption,
        }))}
      />

      <ApprovalSection
        releaseUuid={uuid}
        approvals={serializedApprovals}
        priorApprovers={priorApprovers.filter((p) => p.email)}
      />

      <FinalizeContent
        releaseUuid={uuid}
        releaseTitle={release.title || 'Untitled Release'}
        distribution={release.distribution}
      />
    </div>
  )
}
