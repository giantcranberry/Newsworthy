import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, brandCredits, adCampaigns } from '@/db/schema'
import { eq, and, sql, asc, or, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { UpgradesForm } from './upgrades-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'
import { isDistributionUpgrade } from '@/lib/pr-checkout'

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

// Upgrades already applied to a release. The distribution column only ever
// holds 'standard', 'yahoo' or 'enhanced'; every other upgrade is recorded by
// the credit ledger entry or the ad campaign it created.
async function getAppliedUpgrades(release: { id: number; distribution: string | null }) {
  const redeemed = await db
    .select({ productType: brandCredits.productType })
    .from(brandCredits)
    .where(and(eq(brandCredits.prId, release.id), sql`${brandCredits.credits} < 0`))

  const campaign = await db
    .select({ id: adCampaigns.id })
    .from(adCampaigns)
    .where(eq(adCampaigns.releaseId, release.id))
    .limit(1)

  return Array.from(
    new Set([
      ...(isDistributionUpgrade(release.distribution || '') ? [release.distribution!] : []),
      ...redeemed
        .map((r) => r.productType)
        .filter((t): t is string => !!t && t !== 'pr' && t !== 'credits'),
      ...(campaign.length > 0 ? ['ads'] : []),
    ]),
  )
}

async function getCreditBalance(userId: number, companyId: number) {
  // Credits are usable if they're allocated to the brand OR sitting at the
  // user/account level (companyId IS NULL).
  const credits = await db
    .select({
      productType: brandCredits.productType,
      totalCredits: sql<number>`sum(${brandCredits.credits})`.mapWith(Number),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        or(eq(brandCredits.companyId, companyId), isNull(brandCredits.companyId)),
      ),
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
  const appliedUpgrades = await getAppliedUpgrades(release)

  return (
    <UpgradesForm
      releaseUuid={uuid}
      appliedUpgrades={appliedUpgrades}
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
