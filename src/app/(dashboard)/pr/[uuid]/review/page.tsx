import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions, releaseImages, releaseCategories, releaseRegions, advocacyGroups, advocates } from '@/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { ReviewContent } from './review-content'

async function getReleaseWithDetails(uuid: string, userId: number) {
  const release = await db.query.releases.findFirst({
    where: and(
      eq(releases.uuid, uuid),
      eq(releases.userId, userId)
    ),
    with: {
      company: true,
      primaryContact: true,
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

async function getReleaseCategoryCount(releaseId: number) {
  const cats = await db.select({ categoryId: releaseCategories.categoryId })
    .from(releaseCategories)
    .where(eq(releaseCategories.releaseId, releaseId))
  return cats.length
}

async function getReleaseRegionCount(releaseId: number) {
  const regs = await db.select({ regionId: releaseRegions.regionId })
    .from(releaseRegions)
    .where(eq(releaseRegions.releaseId, releaseId))
  return regs.length
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

export default async function ReviewPage({
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

  const [options, categoryCount, regionCount, listCount] = await Promise.all([
    release.id ? getReleaseOptions(release.id) : null,
    getReleaseCategoryCount(release.id),
    getReleaseRegionCount(release.id),
    getListCount(release.companyId),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review</h1>
        <p className="text-gray-500">
          Review your press release before finalizing
        </p>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={6}
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

      <ReviewContent
        releaseUuid={uuid}
        release={{
          title: release.title,
          abstract: release.abstract,
          body: release.body,
          pullquote: release.pullquote,
          location: release.location,
          releaseAt: release.releaseAt,
          videoUrl: release.videoUrl,
          landingPage: release.landingPage,
        }}
        company={{
          logoUrl: release.company?.logoUrl || null,
          companyName: release.company?.companyName || null,
        }}
        contact={{
          name: release.primaryContact?.name || null,
          email: release.primaryContact?.email || null,
        }}
        banner={release.banner ? {
          url: release.banner.url,
        } : null}
        images={release.releaseImages?.map(ri => ({
          id: ri.image.id,
          url: ri.image.url,
          caption: ri.image.caption,
        })) || []}
        stats={{
          categoryCount,
          regionCount,
          listCount,
          shareWithList: options?.advocacy || false,
          distribution: release.distribution || null,
        }}
      />
    </div>
  )
}
