import Link from 'next/link'
import { db, eq, and, ne, lte, desc, inArray, releases, releaseCategories, category } from '@/lib/db'

import { PressRelease } from '@/types/Release'

import { notFound } from 'next/navigation'
import { HorizontalNews } from '@/components/news_card'
import SeeYourNewsGutter from '@/components/see_your_news_gutter'
import { headers } from 'next/headers'
import { FeedStatsType } from '@/types/Stats'
import { postESGeneric } from '@/lib/elastic'

type Props = {
  params: Promise<{ slug: string }>
}

export const revalidate = 0

export default async function NewsBeat({ params }: Props) {
  const { slug } = await params
  const currentDatetime = new Date()
  const oneHourAgo = new Date(currentDatetime.getTime() - 60 * 60 * 1000)

  const cat = await db.query.category.findFirst({
    where: eq(category.slug, slug),
  })

  if (!cat) {
    return notFound()
  }

  // Build beat_info object
  const beat_info = {
    beat_desc: cat.description,
    parent_beat: cat.parentCategory,
    parent_slug: cat.parentSlug,
    name: cat.name,
  }

  // Get release IDs that belong to this category
  const categoryReleaseIds = await db
    .select({ releaseId: releaseCategories.releaseId })
    .from(releaseCategories)
    .where(eq(releaseCategories.categoryId, cat.id))

  const releaseIdList = categoryReleaseIds.map((r) => r.releaseId)

  if (releaseIdList.length === 0) {
    return notFound()
  }

  // Retrieve news related to the category with given conditions
  const current_releases = (await db.query.releases.findMany({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      companyId: true,
      userId: true,
      uuid: true,
      slug: true,
      releasedAt: true,
      timezone: true,
      status: true,
      abstract: true,
      isFeatured: true,
      score: true,
    },
    with: {
      banner: {
        columns: {
          cdnUrl: true,
        },
      },
    },
    where: and(
      eq(releases.isDeleted, false),
      inArray(releases.id, releaseIdList),
      lte(releases.releaseAt, currentDatetime),
      lte(releases.approvedAt, currentDatetime),
      ne(releases.isFeatured, false),
    ),
    orderBy: desc(releases.releasedAt),
    limit: 30,
  })) as PressRelease[] | null

  if (!current_releases) {
    return notFound()
  }

  const release_list = current_releases
  const releaseIds = current_releases.map((release) => release.id)
  const releaseUuids = current_releases.map((release) => release.uuid)

  const headersList = await headers()
  const referrer = headersList.get('referer')
  const visitor_ip =
    headersList.get('x-forwarded-for') || headersList.get('remote_addr')
  const visitor_ua = headersList.get('user-agent')
  const visitor_host = headersList.get('host')
  const visitor_path = headersList.get('next-url')
  const user_platform = headersList.get('sec-ch-ua-platform')

  let platform = null
  if (user_platform) {
    platform = user_platform.replace(/"/g, '')
  }

  const stats: FeedStatsType = {
    feed_type: 'ws-frontpage',
    created_at: currentDatetime,
    category: slug,
    request_ip: visitor_ip,
    user_agent: visitor_ua,
    referrer: referrer,
    user_platform: platform,
    pr_ids: releaseIds,
    pr_uuids: releaseUuids,
    feed_url: visitor_path,
  }

  postESGeneric(stats, 'nw_feedstats')

  return (
    <div className="mx-auto w-full pb-16">
      {/* Category header */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              {beat_info.parent_beat && (
                <Link
                  href={beat_info.parent_slug ? `/news/beat/${beat_info.parent_slug}` : '/'}
                  className="text-xs font-medium uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {beat_info.parent_beat}
                </Link>
              )}
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mt-1">
                {beat_info.name}
              </h1>
              {beat_info.beat_desc && (
                <p className="mt-2 text-gray-500 text-base max-w-2xl">
                  {beat_info.beat_desc}
                </p>
              )}
            </div>
            <Link
              href="/"
              className="text-sm font-medium text-gray-400 hover:text-gray-900 transition-colors shrink-0"
            >
              All News
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-10 lg:gap-14">
          {/* News feed */}
          <div>
            <div className="divide-y divide-gray-100">
              {release_list.map((release) => (
                <HorizontalNews key={release.id} release={release} />
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              <SeeYourNewsGutter />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
