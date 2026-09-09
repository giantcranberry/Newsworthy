import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { images, banners, files } from '@/db/schema'
import { eq, and, desc, sql, or, isNull } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { AssetsForm } from './assets-form'
import { BrandFilesPanel } from './brand-files-panel'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Newspaper, Share2, Paperclip } from 'lucide-react'

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
        source: null as string | null,
        sourceLink: null as string | null,
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    }
  }

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

async function getBrandFiles(companyId: number, page: number) {
  const perPage = 24
  const notDeleted = and(
    eq(files.companyId, companyId),
    or(eq(files.isDeleted, false), isNull(files.isDeleted)),
  )

  const items = await db
    .select()
    .from(files)
    .where(notDeleted)
    .orderBy(desc(files.id))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(files)
    .where(notDeleted)

  const total = Number(countRow?.count || 0)

  return {
    items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage) || 1,
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

  const [filesRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(files)
    .where(
      and(
        eq(files.companyId, companyId),
        or(eq(files.isDeleted, false), isNull(files.isDeleted)),
      )
    )

  return {
    news: Number(newsRow?.count || 0),
    social: Number(socialRow?.count || 0),
    files: Number(filesRow?.count || 0),
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
  const filter =
    filterParam === 'social' ? 'social' : filterParam === 'files' ? 'files' : 'news'

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const counts = await getCounts(co.id, userId, isAdmin)
  const imageData = filter === 'files' ? null : await getImages(co.id, userId, page, filter, isAdmin)
  const fileData = filter === 'files' ? await getBrandFiles(co.id, page) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Media Assets</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} hasAssets />

      <div className="grid grid-cols-3 gap-4">
        <Link href={`/company/${co.uuid}/assets?filter=news`}>
          <Card className={`cursor-pointer transition-colors ${filter === 'news' ? 'ring-2 ring-cyan-700' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <Newspaper className="h-5 w-5 text-cyan-700 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.news}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">News Images</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/company/${co.uuid}/assets?filter=social`}>
          <Card className={`cursor-pointer transition-colors ${filter === 'social' ? 'ring-2 ring-purple-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <Share2 className="h-5 w-5 text-purple-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.social}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Social Images</p>
            </CardContent>
          </Card>
        </Link>
        <Link href={`/company/${co.uuid}/assets?filter=files`}>
          <Card className={`cursor-pointer transition-colors ${filter === 'files' ? 'ring-2 ring-emerald-600' : 'hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950'}`}>
            <CardContent className="pt-4 pb-4 text-center">
              <Paperclip className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.files}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Files</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {filter === 'files' && fileData ? (
        <BrandFilesPanel
          readOnly={isReadOnly}
          companyUuid={co.uuid}
          files={fileData.items}
          totalFiles={fileData.total}
          currentPage={fileData.page}
          totalPages={fileData.totalPages}
        />
      ) : imageData ? (
        <AssetsForm
          readOnly={isReadOnly}
          companyUuid={co.uuid}
          images={imageData.items}
          totalImages={imageData.total}
          currentPage={imageData.page}
          totalPages={imageData.totalPages}
          filter={filter}
          counts={counts}
          videoShortsOptOut={co.videoShortsOptOut ?? false}
          hideFilterCards
        />
      ) : null}
    </div>
  )
}
