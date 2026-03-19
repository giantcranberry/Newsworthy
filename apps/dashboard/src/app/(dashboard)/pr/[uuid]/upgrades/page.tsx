import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, brandCredits } from '@/db/schema'
import { eq, and, sql, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { UpgradesForm } from './upgrades-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithDetails(uuid: string) {
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

async function getCreditBalance(userId: number, companyId: number) {
  const credits = await db
    .select({
      productType: brandCredits.productType,
      totalCredits: sql<number>`sum(${brandCredits.credits})`.mapWith(Number),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        eq(brandCredits.companyId, companyId)
      )
    )
    .groupBy(brandCredits.productType)

  const balance: Record<string, number> = {}
  credits.forEach((c) => {
    if (c.productType) {
      balance[c.productType] = c.totalCredits
    }
  })

  return balance
}

export default async function UpgradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ success?: string; canceled?: string; session_id?: string }>
}) {
  const { uuid } = await params
  const { success, canceled, session_id } = await searchParams
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithDetails(uuid)

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
  const creditBalance = await getCreditBalance(userId, release.companyId)

  return (
    <UpgradesForm
      releaseUuid={uuid}
      distribution={release.distribution || null}
      creditBalance={creditBalance}
      paymentSuccess={success === 'true'}
      paymentCanceled={canceled === 'true'}
      sessionId={session_id || null}
    >
      <WizardNav
        releaseUuid={uuid}
        currentStep={6}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />
    </UpgradesForm>
  )
}
