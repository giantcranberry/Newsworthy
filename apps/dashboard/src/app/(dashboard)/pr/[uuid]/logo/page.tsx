import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company, releaseOptions, releaseImages } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { LogoForm } from './logo-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithCompany(uuid: string) {
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

  const release = await getReleaseWithCompany(uuid)

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

  return (
    <LogoForm
      releaseUuid={uuid}
      currentLogoUrl={release.company?.logoUrl || null}
      companyName={release.company?.companyName || ''}
    >
      <WizardNav
        releaseUuid={uuid}
        currentStep={2}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />
    </LogoForm>
  )
}
