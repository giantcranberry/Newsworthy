import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, banners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { SocialForm } from './social-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithBanner(uuid: string) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
    },
  })

  return release
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

export default async function SocialPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithBanner(uuid)

  if (!release) {
    notFound()
  }

  // Check access: owner or team member
  if (release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      notFound()
    }
  }

  const options = release.id ? await getReleaseOptions(release.id) : null

  // Fetch existing banners for this company (exclude current banner, exclude deleted)
  const bannerLibrary = await db.query.banners.findMany({
    where: and(
      eq(banners.companyId, release.companyId),
      eq(banners.isDeleted, false),
      eq(banners.isArchived, false),
    ),
    orderBy: (banners, { desc }) => [desc(banners.id)],
    limit: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Social Banner</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Upload an image optimized for social media sharing
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={5}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />

      <SocialForm
        releaseUuid={uuid}
        banner={release.banner || null}
        releaseTitle={release.title || ''}
        bannerLibrary={bannerLibrary}
      />
    </div>
  )
}
