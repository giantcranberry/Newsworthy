import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, approvals } from '@/db/schema'
import { eq, and, asc, ne } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { FinalizeContent } from './finalize-content'
import { processReleaseEmails } from '@/lib/release-emails'
import { normalizeTimezone } from '@/lib/timezones'

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

  // Extract emails from body, store hashes, and replace with newsworthy.email links
  if (release.body) {
    await processReleaseEmails(release.id, release.body)
  }

  // Check for missing required fields
  const missingItems: { label: string; path: string }[] = []
  if (!release.title) missingItems.push({ label: 'Headline', path: `/pr/${uuid}` })
  if (!release.abstract) missingItems.push({ label: 'Abstract/Summary', path: `/pr/${uuid}` })
  if (!release.body) missingItems.push({ label: 'Press release content', path: `/pr/${uuid}` })
  if (!release.location) missingItems.push({ label: 'Location', path: `/pr/${uuid}` })
  if (!release.primaryContactId) missingItems.push({ label: 'Primary contact', path: `/pr/${uuid}` })
  if (!release.company?.logoUrl) missingItems.push({ label: 'Company logo', path: `/pr/${uuid}/logo` })
  if (!release.bannerId) missingItems.push({ label: 'Social banner image', path: `/pr/${uuid}/social` })

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
    <div className="space-y-6">
      <FinalizeContent
        releaseUuid={uuid}
        releaseTitle={release.title || 'Untitled Release'}
        releaseAt={release.releaseAt?.toISOString() ?? null}
        releaseTimezone={normalizeTimezone(release.timezone)}
        distribution={release.distribution}
        initialApprovals={serializedApprovals}
        priorApprovers={priorApprovers.filter((p) => p.email)}
        missingItems={missingItems}
        wizardNav={
          <WizardNav
            releaseUuid={uuid}
            currentStep={8}
            release={release}
            company={release.company || undefined}
            releaseOptions={options || undefined}
          />
        }
      />
    </div>
  )
}
