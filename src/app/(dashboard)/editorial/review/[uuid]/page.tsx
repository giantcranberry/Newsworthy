import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, queue, company, users, releaseCategories, releaseRegions, category, region } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import { ReviewForm } from './review-form'

async function getReleaseForReview(uuid: string) {
  const result = await db
    .select({
      release: releases,
      queue: queue,
      company: company,
      user: users,
    })
    .from(releases)
    .innerJoin(queue, eq(queue.releaseId, releases.id))
    .innerJoin(company, eq(releases.companyId, company.id))
    .innerJoin(users, eq(releases.userId, users.id))
    .where(eq(releases.uuid, uuid))
    .limit(1)

  if (result.length === 0) return null

  const releaseData = result[0]

  // Get categories from junction table
  const categories = await db
    .select({ name: category.name })
    .from(releaseCategories)
    .innerJoin(category, eq(releaseCategories.categoryId, category.id))
    .where(eq(releaseCategories.releaseId, releaseData.release.id))

  // Get regions from junction table
  const regions = await db
    .select({ name: region.name })
    .from(releaseRegions)
    .innerJoin(region, eq(releaseRegions.regionId, region.id))
    .where(eq(releaseRegions.releaseId, releaseData.release.id))

  return {
    ...releaseData,
    categoryNames: categories.map(c => c.name).filter(Boolean),
    regionNames: regions.map(r => r.name).filter(Boolean),
  }
}

interface PageProps {
  params: Promise<{ uuid: string }>
}

export default async function EditorialReviewPage({ params }: PageProps) {
  const { uuid } = await params
  const session = await auth()

  // Check if user has editorial access
  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isEditor && !isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const data = await getReleaseForReview(uuid)

  if (!data) {
    notFound()
  }

  const editorId = parseInt(session?.user?.id || '0')
  const editorName = session?.user?.name || session?.user?.email || 'Editor'

  return (
    <div className="space-y-6">
      <ReviewForm
        release={data.release}
        queue={data.queue}
        company={data.company}
        user={data.user}
        categoryNames={data.categoryNames}
        regionNames={data.regionNames}
        editorId={editorId}
        editorName={editorName}
      />
    </div>
  )
}
