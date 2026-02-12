import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company, releaseOptions, releaseImages } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { LogoForm } from './logo-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'

async function getReleaseWithCompany(uuid: string, userId: number) {
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

export default async function LogoPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithCompany(uuid, userId)

  if (!release) {
    notFound()
  }

  const options = release.id ? await getReleaseOptions(release.id) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Brand Logo</h1>
        <p className="text-gray-500">
          Logo for {release.company?.companyName}
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={2}
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

      <LogoForm
        releaseUuid={uuid}
        currentLogoUrl={release.company?.logoUrl || null}
        companyName={release.company?.companyName || ''}
      />
    </div>
  )
}
