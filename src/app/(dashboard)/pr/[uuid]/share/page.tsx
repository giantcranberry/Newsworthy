import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, advocacyGroups, advocates } from '@/db/schema'
import { eq, and, sql, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ShareForm } from './share-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'

async function getReleaseWithOptions(uuid: string, userId: number) {
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

async function getListCount(companyId: number) {
  const group = await db.query.advocacyGroups.findFirst({
    where: eq(advocacyGroups.coId, companyId),
  })

  if (!group) return 0

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(advocates)
    .where(and(
      eq(advocates.groupId, group.id),
      sql`${advocates.isDeleted} IS NOT TRUE`,
      sql`${advocates.unsubscribeAt} IS NULL`,
      sql`${advocates.bouncedAt} IS NULL`
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

  const release = await getReleaseWithOptions(uuid, userId)

  if (!release) {
    notFound()
  }

  const options = release.id ? await getReleaseOptions(release.id) : null
  const listCount = await getListCount(release.companyId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Share with My List</h1>
        <p className="text-gray-500">
          Share this release with your subscribers
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={4}
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

      <ShareForm
        releaseUuid={uuid}
        companyUuid={release.company?.uuid || ''}
        shareWithList={options?.advocacy || false}
        companyName={release.company?.companyName || ''}
        listCount={listCount}
      />
    </div>
  )
}
