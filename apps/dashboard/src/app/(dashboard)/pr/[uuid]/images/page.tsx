import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, images, releaseImages, releaseOptions, banners } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { ImagesContent } from './images-content'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithImages(uuid: string) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
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

async function getImageLibrary(companyId: number, userId: number) {
  return await db.query.images.findMany({
    where: and(
      eq(images.companyId, companyId),
      eq(images.userId, userId),
      eq(images.isDeleted, false)
    ),
    orderBy: (images, { desc }) => [desc(images.id)],
    limit: 20,
  })
}

async function getBannerLibrary(companyId: number) {
  return await db.query.banners.findMany({
    where: and(
      eq(banners.companyId, companyId),
      eq(banners.isDeleted, false),
      eq(banners.isArchived, false),
    ),
    orderBy: (banners, { desc }) => [desc(banners.id)],
    limit: 50,
  })
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

export default async function ImagesPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithImages(uuid)

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

  const imageLibrary = await getImageLibrary(release.companyId, userId)
  const bannerLibrary = await getBannerLibrary(release.companyId)
  const options = release.id ? await getReleaseOptions(release.id) : null

  // Map releaseImages to the shape the form expects
  const formReleaseImages = release.releaseImages.map((ri) => ({
    id: ri.id,
    imageId: ri.imageId,
    sortOrder: ri.sortOrder,
    image: ri.image,
  }))

  return (
    <ImagesContent
      releaseUuid={uuid}
      releaseImages={formReleaseImages}
      imageLibrary={imageLibrary}
      banner={release.banner || null}
      releaseTitle={release.title || ''}
      bannerLibrary={bannerLibrary}
    >
      <WizardNav
        releaseUuid={uuid}
        currentStep={4}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />
    </ImagesContent>
  )
}
