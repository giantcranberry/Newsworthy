import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, images, releaseImages, releaseOptions } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ImageForm } from './image-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'

async function getReleaseWithImages(uuid: string, userId: number) {
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

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

export default async function ImagePage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithImages(uuid, userId)

  if (!release) {
    notFound()
  }

  const imageLibrary = await getImageLibrary(release.companyId, userId)
  const options = release.id ? await getReleaseOptions(release.id) : null

  // Map releaseImages to the shape the form expects
  const formReleaseImages = release.releaseImages.map((ri) => ({
    id: ri.id,
    imageId: ri.imageId,
    sortOrder: ri.sortOrder,
    image: ri.image,
  }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">News Images</h1>
        <p className="text-gray-500">
          Add images for your press release
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={3}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />

      <ImageForm
        releaseUuid={uuid}
        releaseImages={formReleaseImages}
        imageLibrary={imageLibrary}
      />
    </div>
  )
}
