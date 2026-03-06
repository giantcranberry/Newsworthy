import Image from 'next/image'
import Link from 'next/link'
import SearchInput from '@/components/search'
import { db, eq, and, ne, lte, desc, inArray, releases, releaseCategories, category } from '@/lib/db'

import { newsUrl } from '@/lib/utils'

import { PressRelease } from '@/types/Release'

import Influencer from '@/components/influencer_card'
import { notFound } from 'next/navigation'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { MobileNewsCard } from '@/components/mobile_news_card'
import LatestDialog from '@/components/latest'
import TrendingDialog from '@/components/trending'
import { TrendingNews } from '@/components/trending_news'
import TrustedDialog from '@/components/trusted'
import { HorizontalNews } from '@/components/news_card'
import SeeYourNews from '@/components/see_your_news'
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
    <div className="mx-auto w-full pb-10">
      <div>
        <div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl mt-5 px-5 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
            <div className="md:col-span-1">
              <div className="px-5 mb-5 md:px-10 lg:px-0">
                <div className="flex justify-between items-baseline">
                  <h1 className="text-2xl lg:text-4xl font-bold pb-2">
                    {beat_info.name}
                  </h1>
                  <a
                    href="/"
                    className="md:text-lg text-sky-700 hover:underline"
                  >
                    Latest News on Newsworthy
                  </a>
                </div>
                <hr />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-1 gap-10 md:px-10 lg:px-0 lg:border-b lg:last-of-type:border-0">
                {release_list.map((release) => (
                  <HorizontalNews key={release.id} release={release} />
                ))}
              </div>
            </div>
            <div className="w-full lg:max-w-[350px] flex flex-col md:flex-col gap-5 px-5 lg:px-0">
              <SeeYourNews />
            </div>
          </div>
        </div>
        {/* <CenteredContentBand band={bands[1]} /> */}
      </div>
    </div>
  )
}
