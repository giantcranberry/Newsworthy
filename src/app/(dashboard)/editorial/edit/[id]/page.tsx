import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, company, contact, category, region, releaseCategories, releaseRegions, releaseImages, banners, images } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import { EditorialEditForm } from './editorial-edit-form'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditorialEditPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    redirect('/dashboard')
  }

  const prId = parseInt(id)
  if (isNaN(prId)) notFound()

  // Fetch the release
  const releaseResult = await db
    .select()
    .from(releases)
    .where(eq(releases.id, prId))
    .limit(1)

  if (releaseResult.length === 0) notFound()
  const release = releaseResult[0]

  // Fetch company
  const companyResult = await db
    .select()
    .from(company)
    .where(eq(company.id, release.companyId))
    .limit(1)
  const releaseCompany = companyResult[0]

  // Fetch contacts for this company
  const contacts = await db
    .select()
    .from(contact)
    .where(eq(contact.companyId, release.companyId))

  // Fetch all categories
  const allCategories = await db
    .select()
    .from(category)
    .orderBy(asc(category.parentCategory), asc(category.name))

  // Top-level categories (where parent_category = 'top')
  const topCategories = allCategories.filter((c) => c.parentCategory === 'top')

  // Fetch all regions
  const allRegions = await db
    .select()
    .from(region)
    .orderBy(asc(region.state), asc(region.name))

  // Fetch current release categories
  const currentCategories = await db
    .select({ categoryId: releaseCategories.categoryId })
    .from(releaseCategories)
    .where(eq(releaseCategories.releaseId, prId))

  // Fetch current release regions
  const currentRegions = await db
    .select({ regionId: releaseRegions.regionId })
    .from(releaseRegions)
    .where(eq(releaseRegions.releaseId, prId))

  // Fetch release images with image data
  const releaseImagesData = await db.query.releaseImages.findMany({
    where: eq(releaseImages.releaseId, prId),
    orderBy: [asc(releaseImages.sortOrder)],
    with: { image: true },
  })

  let formReleaseImages = releaseImagesData.map((ri) => ({
    id: ri.id,
    imageId: ri.imageId,
    sortOrder: ri.sortOrder,
    image: {
      id: ri.image.id,
      uuid: ri.image.uuid,
      url: ri.image.url,
      title: ri.image.title || null,
      imgCredits: ri.image.imgCredits || null,
    },
  }))

  // Fallback: if no junction table entries but primaryImageId is set, fetch it directly
  if (formReleaseImages.length === 0 && release.primaryImageId) {
    const primaryImg = await db
      .select()
      .from(images)
      .where(eq(images.id, release.primaryImageId))
      .limit(1)
    if (primaryImg.length > 0) {
      const img = primaryImg[0]
      formReleaseImages = [{
        id: 0,
        imageId: img.id,
        sortOrder: 0,
        image: {
          id: img.id,
          uuid: img.uuid,
          url: img.url,
          title: img.title || null,
          imgCredits: img.imgCredits || null,
        },
      }]
    }
  }

  // Fetch banner if one exists
  let bannerData = null
  if (release.bannerId) {
    const bannerResult = await db
      .select()
      .from(banners)
      .where(eq(banners.id, release.bannerId))
      .limit(1)
    if (bannerResult.length > 0) {
      bannerData = {
        id: bannerResult[0].id,
        uuid: bannerResult[0].uuid,
        url: bannerResult[0].url,
        title: bannerResult[0].title || null,
        imgCredits: bannerResult[0].imgCredits || null,
      }
    }
  }

  return (
    <div className="space-y-6">
      <EditorialEditForm
        release={{
          id: release.id,
          uuid: release.uuid,
          status: release.status,
          title: release.title || '',
          abstract: release.abstract || '',
          body: release.body || '',
          pullquote: release.pullquote || '',
          location: release.location || '',
          videoUrl: release.videoUrl || '',
          landingPage: release.landingPage || '',
          publicDrive: release.publicDrive || '',
          releaseAt: release.releaseAt?.toISOString() ?? null,
          timezone: release.timezone || '',
          primaryContactId: release.primaryContactId,
        }}
        company={{
          id: releaseCompany.id,
          name: releaseCompany.companyName || '',
          timezone: releaseCompany.timezone || '',
        }}
        contacts={contacts.map((c) => ({
          id: c.id,
          uuid: c.uuid || '',
          name: c.name,
          email: c.email || '',
        }))}
        topCategories={topCategories.map((c) => ({
          id: c.id,
          name: c.name,
        }))}
        allCategories={allCategories.map((c) => ({
          id: c.id,
          name: c.name,
          parentCategory: c.parentCategory || '',
        }))}
        allRegions={allRegions.map((r) => ({
          id: r.id,
          name: r.name,
          state: r.state,
        }))}
        selectedCategoryIds={currentCategories.map((c) => c.categoryId)}
        selectedRegionIds={currentRegions.map((r) => r.regionId)}
        releaseImages={formReleaseImages}
        banner={bannerData}
      />
    </div>
  )
}
