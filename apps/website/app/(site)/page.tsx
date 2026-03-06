import Head from "next/head";
import { db, and, or, eq, gt, gte, lte, desc, count, releases } from '@/lib/db';
import { PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { getCategorySections, getSiteAdBySlug } from "@/sanity/sanity-utils";
import TrustedDialog from "@/components/trusted";
import LatestDialog from "@/components/latest";
import { HorizontalNews } from "@/components/news_card";
import { CardNews } from "@/components/home_news_card";
import { MobileNewsCard } from "@/components/mobile_news_card";
import SeeYourNews from "@/components/see_your_news";
import { headers } from "next/headers";
import { FeedStatsType } from "@/types/Stats";
import { postESGeneric } from "@/lib/elastic";
import { TrendingFeeds } from "@/components/trending_feeds";

import FreePrReview from "@/components/free-pr-review";
import SearchBoxComponent from "@/components/search";

export const revalidate = 0;

const currentDatetime = new Date();
const oneHourAgo = new Date(currentDatetime.getTime() - 60 * 60 * 1000);
type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const itemsPerPage = 20;
  const sectionSlugs: string[] = ["see-your-news-here", "hey-influencer"];

  const bands = await getCategorySections(sectionSlugs);
  const band_count = bands.length;


  const fourHoursAgo = new Date(new Date().getTime() - 4 * 60 * 60 * 1000);

  // Get total count for pagination
  const [{ count: totalCount }] = await db.select({ count: count() }).from(releases).where(
    and(
      eq(releases.isDeleted, false),
      or(
        and(
          lte(releases.releasedAt, currentDatetime),
          gt(releases.score, 3),
          eq(releases.isFeatured, true),
        ),
        and(
          gt(releases.releasedAt, fourHoursAgo),
          lte(releases.releasedAt, currentDatetime),
          eq(releases.score, 3),
          eq(releases.isFeatured, true),
        ),
        and(
          eq(releases.isFeatured, false),
          gte(releases.releasedAt, fourHoursAgo),
        ),
      ),
    ),
  );

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const skip = (page - 1) * itemsPerPage;

  const current_releases = await db.query.releases.findMany({
    limit: itemsPerPage + 4, // +2 for featured posts, +2 extra for layout
    offset: skip,
    columns: {
      id: true,
      title: true,
      selfHost: true,
      uuid: true,
      companyId: true,
      userId: true,
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
      or(
        and(
          lte(releases.releasedAt, currentDatetime),
          gt(releases.score, 3),
          eq(releases.isFeatured, true),
        ),
        and(
          gt(releases.releasedAt, fourHoursAgo),
          lte(releases.releasedAt, currentDatetime),
          eq(releases.score, 3),
          eq(releases.isFeatured, true),
        ),
        and(
          eq(releases.isFeatured, false),
          gte(releases.releasedAt, fourHoursAgo),
        ),
      ),
    ),
    orderBy: desc(releases.releasedAt),
  }) as PressRelease[];

  const [featured, secondFeatured, ...releasesList] = current_releases;
  const releaseIds = current_releases.map((release) => release.id);
  const releaseUuids = current_releases.map((release) => release.uuid);

  const headersList = await headers();
  const referrer = headersList.get("referer");
  const visitor_ip =
    headersList.get("x-forwarded-for") || headersList.get("remote_addr");
  const visitor_ua = headersList.get("user-agent");
  const visitor_host = headersList.get("host");
  const visitor_path = headersList.get("next-url");
  const user_platform = headersList.get("sec-ch-ua-platform");

  const stats: FeedStatsType = {
    feed_type: "ws-frontpage",
    created_at: currentDatetime,
    request_ip: visitor_ip,
    user_agent: visitor_ua,
    referrer: referrer,
    user_platform: user_platform,
    pr_ids: releaseIds,
    pr_uuids: releaseUuids,
    feed_url: visitor_path,
  };

  postESGeneric(stats, "nw_feedstats");

  return (
    <>
      <SearchBoxComponent />
      <div className="mx-auto w-full pb-10">
        <div>
          <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-7 px-5">
            <TrendingFeeds />
          </section>
          <section className="grid lg:grid-cols-8 mx-auto max-w-screen-xl xl:max-w-screen-2xl gap-10 mt-5 px-5">
            {featured && (
              <div
                className="lg:col-span-4 group rounded bg-white transition duration-500"
                key={featured.id}
              >
                <div className="overflow-hidden rounded border border-slate-200 group-hover:shadow-lg transition duration-500">
                  <Link href={newsUrl(featured)}>
                    {featured.banner?.cdnUrl && (
                      <Image
                        className="hover:translate-8 transition duration-500 ease-in-out group-hover:scale-105"
                        src={featured.banner.cdnUrl.replace(
                          "resize=width:328",
                          "resize=width:1200"
                        )}
                        width={1200}
                        height={630}
                        priority={true}
                        alt={`banner image for: ${featured.title}`}
                      />
                    )}
                  </Link>
                </div>
                <div className="pt-5 flex flex-col items-start gap-5">
                  <div>
                    {featured.selfHost && <TrustedDialog />}
                    <Link
                      className="font-serif text-xl md:text-2xl md:group-hover:text-sky-700 mb-4"
                      href={newsUrl(featured)}
                    >
                      {featured.title}
                    </Link>
                    <p className="mt-2 text-md lg:text-base leading-6">
                      {featured.abstract}
                      <Link
                        className="text-sky-800 font-sans pl-2 font-bold hover:underline"
                        href={newsUrl(featured)}
                      >
                        Read the release
                        <i className="fa-solid fa-chevron-right pl-1 text-sm"></i>
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
            {secondFeatured && (
              <div
                className="lg:col-span-4 group rounded bg-white transition duration-500"
                key={secondFeatured.id}
              >
                <div className="overflow-hidden rounded border border-slate-200 group-hover:shadow-lg transition duration-500">
                  <Link href={newsUrl(secondFeatured)}>
                    {secondFeatured.banner?.cdnUrl && (
                      <Image
                        className="hover:translate-8 transition duration-500 ease-in-out group-hover:scale-105"
                        src={secondFeatured.banner.cdnUrl.replace(
                          "resize=width:328",
                          "resize=width:1200"
                        )}
                        width={1200}
                        height={630}
                        priority={true}
                        alt={`banner image for: ${secondFeatured.title}`}
                      />
                    )}
                  </Link>
                </div>
                <div className="pt-5 flex flex-col items-start gap-5">
                  <div>
                    {secondFeatured.selfHost && <TrustedDialog />}
                    <Link
                      className="font-serif text-xl md:text-2xl md:group-hover:text-sky-700 mb-4"
                      href={newsUrl(secondFeatured)}
                    >
                      {secondFeatured.title}
                    </Link>
                    <p className="mt-2 text-md lg:text-base leading-6">
                      {secondFeatured.abstract}
                      <Link
                        className="text-sky-800 font-sans pl-2 font-bold hover:underline"
                        href={newsUrl(secondFeatured)}
                      >
                        Read the release
                        <i className="fa-solid fa-chevron-right pl-1 text-sm"></i>
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
          <section className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl xl:my-5 px-5 pt-5">
            <SeeYourNews />
          </section>

          <section className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 pt-5 relative">
            <LatestDialog />
            <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
              <div className="lg:col-span-2 gird-row-1">
                <div className="relative lg:hidden max-h-auto">
                  <div className="flex flex-col border-0 mb-0">
                    {releasesList.map(
                      (release, index) =>
                        index < 3 && (
                          <MobileNewsCard key={release.id} release={release} />
                        )
                    )}

                    {releasesList.map(
                      (release, index) =>
                        index > 2 && (
                          <MobileNewsCard key={release.id} release={release} />
                        )
                    )}
                  </div>
                </div>
                <div className="hidden lg:grid lg:grid-cols-6 lg:gap-10">
                  <div className="col-span-4">
                    {releasesList.map(
                      (release, index) =>
                        index < 2 && (
                          <HorizontalNews key={release.id} release={release} />
                        )
                    )}
                    <aside className="block lg:hidden relative my-5 px-5">
                      <FreePrReview />
                    </aside>
                  </div>
                  <aside className="col-span-2 relative mb-5">
                    <FreePrReview />
                  </aside>
                </div>
                <div className="hidden lg:grid lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-5">
                  {releasesList.map(
                    (release, index) =>
                      index > 1 && (
                        <CardNews key={release.id} release={release} />
                      )
                  )}
                </div>
              </div>
            </div>
          </section>
          {/* <CenteredContentBand band={bands[1]} /> */}

          {/* Pagination */}
          {totalPages > 1 && (
            <section className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 pt-10">
              <div className="flex justify-center">
                <nav className="flex items-center gap-2">
                  {page > 1 && (
                    <Link
                      href={`/?page=${page - 1}`}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= page - 2 && pageNum <= page + 2)
                      ) {
                        return (
                          <Link
                            key={pageNum}
                            href={pageNum === 1 ? '/' : `/?page=${pageNum}`}
                            className={`px-3 py-2 text-sm font-medium rounded-md ${
                              pageNum === page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </Link>
                        );
                      } else if (
                        pageNum === page - 3 ||
                        pageNum === page + 3
                      ) {
                        return <span key={pageNum} className="px-2 py-2 text-gray-500">...</span>;
                      }
                      return null;
                    })}
                  </div>

                  {page < totalPages && (
                    <Link
                      href={`/?page=${page + 1}`}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              </div>

              <div className="mt-4 text-center text-sm text-gray-600">
                Showing {skip + 1}-{Math.min(skip + itemsPerPage, totalCount)} of {totalCount} press releases
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
