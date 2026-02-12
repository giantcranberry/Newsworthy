import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company, releaseOptions, releaseImages, category, region, releaseCategories, releaseRegions } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { PRForm } from '../pr-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'

async function getRelease(uuid: string, userId: number) {
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

async function getUserCompanies(userId: number) {
  return await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false)
    ),
    with: {
      contacts: true,
    },
  })
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

async function getCategories() {
  return await db.select().from(category).orderBy(category.name)
}

async function getRegions() {
  return await db.select().from(region).orderBy(region.name)
}

async function getReleaseCategories(releaseId: number) {
  const cats = await db.select({ categoryId: releaseCategories.categoryId })
    .from(releaseCategories)
    .where(eq(releaseCategories.releaseId, releaseId))
  return cats.map(c => c.categoryId)
}

async function getReleaseRegions(releaseId: number) {
  const regs = await db.select({ regionId: releaseRegions.regionId })
    .from(releaseRegions)
    .where(eq(releaseRegions.releaseId, releaseId))
  return regs.map(r => r.regionId)
}

export default async function PRDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ wizard?: string; submitted?: string }>
}) {
  const { uuid } = await params
  const { wizard, submitted } = await searchParams
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const [release, companies, categories, regions] = await Promise.all([
    getRelease(uuid, userId),
    getUserCompanies(userId),
    getCategories(),
    getRegions(),
  ])

  // Get top-level categories (where parent_category = 'top')
  const topCategories = categories.filter(c => c.parentCategory === 'top')

  if (!release) {
    notFound()
  }

  const [options, allSelectedCategories, selectedRegions] = await Promise.all([
    release.id ? getReleaseOptions(release.id) : null,
    getReleaseCategories(release.id),
    getReleaseRegions(release.id),
  ])

  // Find topcat (first category that's a top-level category)
  const topCategoryIds = new Set(topCategories.map(c => c.id))
  const topcat = allSelectedCategories.find(catId => topCategoryIds.has(catId)) || null
  // Other selected categories (excluding topcat)
  const selectedCategories = allSelectedCategories.filter(catId => catId !== topcat)

  const showWizardComplete = wizard === 'complete'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {showWizardComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800">Wizard Complete!</h3>
          <p className="text-sm text-green-700 mt-1">
            Your press release is ready. You can continue editing below or submit for review.
          </p>
        </div>
      )}

      {submitted === 'true' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800">Submitted for Review</h3>
          <p className="text-sm text-blue-700 mt-1">
            Your press release has been submitted to our editorial team for review.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Press Release</h1>
          <p className="text-gray-500">
            Status: <span className="font-medium capitalize">{release.status?.replace('_', ' ')}</span>
          </p>
        </div>
      </div>

      <WizardNav
        releaseUuid={uuid}
        currentStep={1}
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

      <PRForm
        companies={companies}
        categories={categories}
        topCategories={topCategories}
        regions={regions}
        readOnly={['editorial', 'approved', 'published'].includes(release.status || '')}
        initialData={{
          id: release.id,
          uuid: release.uuid,
          title: release.title || '',
          abstract: release.abstract || '',
          body: release.body || '',
          pullquote: release.pullquote || '',
          companyId: release.companyId,
          primaryContactId: release.primaryContactId,
          status: release.status,
          location: release.location || '',
          releaseAt: release.releaseAt,
          timezone: release.timezone,
          videoUrl: release.videoUrl,
          landingPage: release.landingPage,
          publicDrive: release.publicDrive,
          selectedCategories,
          selectedRegions,
          topcat,
        }}
      />
    </div>
  )
}
