import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, images, banners } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { AssetsForm } from './assets-form'

async function getCompany(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

async function getImages(companyId: number, userId: number, page: number, filter: string, isAdmin = false) {
  const perPage = 24

  if (filter === 'social') {
    const notDeleted = isAdmin
      ? and(
          eq(banners.companyId, companyId),
          sql`${banners.isDeleted} IS NOT TRUE`
        )
      : and(
          eq(banners.companyId, companyId),
          eq(banners.userId, userId),
          sql`${banners.isDeleted} IS NOT TRUE`
        )

    const items = await db
      .select()
      .from(banners)
      .where(notDeleted)
      .orderBy(desc(banners.id))
      .limit(perPage)
      .offset((page - 1) * perPage)

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(banners)
      .where(notDeleted)

    const total = Number(countRow?.count || 0)

    return {
      items: items.map((b) => ({
        id: b.id,
        uuid: b.uuid,
        url: b.url,
        title: b.title,
        imgCredits: b.imgCredits,
        width: b.width,
        height: b.height,
        filesize: b.filesize,
        source: null,
        sourceLink: null,
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  }

  // Default: news images
  const notDeleted = isAdmin
    ? and(
        eq(images.companyId, companyId),
        sql`${images.isDeleted} IS NOT TRUE`
      )
    : and(
        eq(images.companyId, companyId),
        eq(images.userId, userId),
        sql`${images.isDeleted} IS NOT TRUE`
      )

  const items = await db
    .select()
    .from(images)
    .where(notDeleted)
    .orderBy(desc(images.id))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(notDeleted)

  const total = Number(countRow?.count || 0)

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  }
}

async function getCounts(companyId: number, userId: number, isAdmin = false) {
  const [newsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(isAdmin
      ? and(
          eq(images.companyId, companyId),
          sql`${images.isDeleted} IS NOT TRUE`
        )
      : and(
          eq(images.companyId, companyId),
          eq(images.userId, userId),
          sql`${images.isDeleted} IS NOT TRUE`
        )
    )

  const [socialRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(banners)
    .where(isAdmin
      ? and(
          eq(banners.companyId, companyId),
          sql`${banners.isDeleted} IS NOT TRUE`
        )
      : and(
          eq(banners.companyId, companyId),
          eq(banners.userId, userId),
          sql`${banners.isDeleted} IS NOT TRUE`
        )
    )

  return {
    news: Number(newsRow?.count || 0),
    social: Number(socialRow?.count || 0),
  }
}

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ page?: string; filter?: string }>
}) {
  const { uuid } = await params
  const { page: pageStr, filter: filterParam } = await searchParams
  const page = parseInt(pageStr || '1')
  const filter = filterParam === 'social' ? 'social' : 'news'

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const co = await getCompany(uuid, userId, isAdmin)
  if (!co) notFound()

  const [imageData, counts] = await Promise.all([
    getImages(co.id, userId, page, filter, isAdmin),
    getCounts(co.id, userId, isAdmin),
  ])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Assets</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <AssetsForm
        companyUuid={co.uuid}
        images={imageData.items}
        totalImages={imageData.total}
        currentPage={imageData.page}
        totalPages={imageData.totalPages}
        filter={filter}
        counts={counts}
      />
    </div>
  )
}
