import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, crmContacts } from '@/db/schema'
import { eq, and, sql, asc, inArray } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ShareForm } from './share-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithOptions(uuid: string) {
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

async function getListCount(companyId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, companyId),
      inArray(crmContacts.contactType, ['advocate', 'both']),
      sql`${crmContacts.isDeleted} IS NOT TRUE`,
      sql`${crmContacts.unsubscribeAt} IS NULL`,
      sql`${crmContacts.bouncedAt} IS NULL`
    ))

  return Number(countRow?.count || 0)
}

async function getMediaListCount(companyId: number) {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, companyId),
      inArray(crmContacts.contactType, ['media', 'both']),
      sql`${crmContacts.isDeleted} IS NOT TRUE`,
      sql`${crmContacts.unsubscribeAt} IS NULL`,
      sql`${crmContacts.bouncedAt} IS NULL`
    ))

  return Number(countRow?.count || 0)
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithOptions(uuid)

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
  const listCount = await getListCount(release.companyId)
  const mediaListCount = await getMediaListCount(release.companyId)

  return (
    <ShareForm
      releaseUuid={uuid}
      companyUuid={release.company?.uuid || ''}
      shareWithList={options?.advocacy ?? listCount > 0}
      sendToPitchList={options?.pitchlist ?? mediaListCount > 0}
      companyName={release.company?.companyName || ''}
      listCount={listCount}
      mediaListCount={mediaListCount}
    >
      <WizardNav
        releaseUuid={uuid}
        currentStep={5}
        release={release}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />
    </ShareForm>
  )
}
