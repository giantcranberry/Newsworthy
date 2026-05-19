import Head from "next/head";
import { db, and, or, eq, gt, gte, lte, desc, count, releases } from "@/lib/db";
import { PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { getCategorySections, getSiteAdBySlug } from "@/sanity/sanity-utils";
import TrustedDialog from "@/components/trusted";
import { CardNews } from "@/components/home_news_card";
import { MobileNewsCard } from "@/components/mobile_news_card";
import BannerAdBand from "@/components/banner-ad/banner-ad-band";
import SeeYourNewsGutter from "@/components/see_your_news_gutter";
import { headers } from "next/headers";
import { FeedStatsType } from "@/types/Stats";
import { postESGeneric } from "@/lib/elastic";
import { TrendingFeeds } from "@/components/trending_feeds";

import FreePrReview from "@/components/free-pr-review";

export const revalidate = 0;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const currentDatetime = new Date();
  const fourHoursAgo = new Date(currentDatetime.getTime() - 4 * 60 * 60 * 1000);

  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const itemsPerPage = 20;
  const sectionSlugs: string[] = ["see-your-news-here", "hey-influencer"];

  const bands = await getCategorySections(sectionSlugs);
  const band_count = bands.length;

  // Get total count for pagination
  const [{ count: totalCount }] = await db
    .select({ count: count() })
    .from(releases)
    .where(
      and(
        eq(releases.isDeleted, false),
        or(
          and(lte(releases.releasedAt, currentDatetime), gt(releases.score, 3)),
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

  const current_releases = (await db.query.releases.findMany({
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
        and(lte(releases.releasedAt, currentDatetime), gt(releases.score, 3)),
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
  })) as PressRelease[];

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
      <div className="mx-auto w-full pb-10">
        <div>
          <section className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-7 px-3 lg:px-5">
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
                          "resize=width:1200",
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
                          "resize=width:1200",
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
          <section className="mx-auto grid w-full max-w-screen-xl grid-cols-1 items-start gap-5 px-5 pt-5 md:grid-cols-2 xl:my-5 xl:max-w-screen-2xl">
            <BannerAdBand slug="news-marketing-book" />
            <BannerAdBand slug="see-your-news-here" />
          </section>

          <section className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-3 lg:px-5 pt-8 relative">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-lg font-extrabold uppercase text-cyan-800">
                Latest News
              </h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Mobile layout */}
            <div className="lg:hidden">
              <div className="flex flex-col">
                {releasesList.map((release, index) => (
                  <MobileNewsCard key={release.id} release={release} />
                ))}
              </div>
              <aside className="my-5 px-5">
                <FreePrReview />
              </aside>
            </div>

            {/* Desktop magazine layout */}
            <div className="hidden lg:block">
              {/* Top row: lead story (large) + sidebar headlines */}
              {releasesList.length > 0 && (
                <div className="grid grid-cols-12 gap-8 pb-8 border-b border-gray-200">
                  {/* Lead story — large image + content */}
                  <div className="col-span-6 group">
                    <Link href={newsUrl(releasesList[0])} className="block">
                      {releasesList[0].banner?.cdnUrl && (
                        <div className="overflow-hidden rounded-lg mb-4">
                          <Image
                            className="w-full aspect-[16/9] object-cover transition duration-300 ease-in-out group-hover:scale-105"
                            src={releasesList[0].banner.cdnUrl.replace(
                              /resize=width:\d+/,
                              "resize=width:1200",
                            )}
                            width={800}
                            height={450}
                            alt={releasesList[0].title || "Press release image"}
                          />
                        </div>
                      )}
                      <div className="flex flex-col gap-2">
                        {releasesList[0].releaseCategories?.[0]?.category && (
                          <span className="text-xs font-medium text-sky-700">
                            {releasesList[0].releaseCategories[0].category.name}
                          </span>
                        )}
                        <h3 className="font-serif text-2xl xl:text-3xl leading-tight group-hover:text-sky-700 transition-colors">
                          {releasesList[0].title}
                        </h3>
                        <p className="text-base text-gray-500 line-clamp-2">
                          {releasesList[0].abstract}
                        </p>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                          <span>{releasesList[0].company?.companyName}</span>
                        </div>
                      </div>
                    </Link>
                  </div>

                  {/* Second story */}
                  {releasesList.length > 1 && (
                    <div className="col-span-6 group">
                      <Link href={newsUrl(releasesList[1])} className="block">
                        {releasesList[1].banner?.cdnUrl && (
                          <div className="overflow-hidden rounded-lg mb-4">
                            <Image
                              className="w-full aspect-[16/9] object-cover transition duration-300 ease-in-out group-hover:scale-105"
                              src={releasesList[1].banner.cdnUrl.replace(
                                /resize=width:\d+/,
                                "resize=width:800",
                              )}
                              width={600}
                              height={338}
                              alt={
                                releasesList[1].title || "Press release image"
                              }
                            />
                          </div>
                        )}
                        <div className="flex flex-col gap-2">
                          {releasesList[1].releaseCategories?.[0]?.category && (
                            <span className="text-xs font-medium text-sky-700">
                              {
                                releasesList[1].releaseCategories[0].category
                                  .name
                              }
                            </span>
                          )}
                          <h3 className="font-serif text-2xl xl:text-3xl leading-tight group-hover:text-sky-700 transition-colors">
                            {releasesList[1].title}
                          </h3>
                          <p className="text-base text-gray-500 line-clamp-2">
                            {releasesList[1].abstract}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                            <span>{releasesList[1].company?.companyName}</span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom grid: remaining stories as cards */}
              {releasesList.length > 2 &&
                (() => {
                  const remaining = releasesList.slice(2);
                  // +1 for the FreePrReview card, round down to nearest multiple of 4
                  const totalSlots = Math.floor((remaining.length + 1) / 4) * 4;
                  const cardCount = totalSlots - 1;
                  const cards = remaining.slice(0, cardCount);
                  return (
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-5 mt-8">
                      {cards.slice(0, 2).map((release) => (
                        <CardNews key={release.id} release={release} />
                      ))}
                      <FreePrReview />
                      {cards.slice(2).map((release) => (
                        <CardNews key={release.id} release={release} />
                      ))}
                    </div>
                  );
                })()}
            </div>
          </section>
          {/* <CenteredContentBand band={bands[1]} /> */}

          {/* Pagination */}
          {totalPages > 1 && (
            <section className="mx-auto w-full max-w-screen-xl xl:max-w-screen-2xl px-5 pt-10">
              <div className="flex justify-center">
                <nav className="flex items-center gap-1.5">
                  {page > 1 && (
                    <Link
                      href={`/?page=${page - 1}`}
                      className="px-4 py-2 text-sm font-medium text-cyan-700 rounded-full hover:bg-cyan-50 transition-colors"
                    >
                      Previous
                    </Link>
                  )}

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                      (pageNum) => {
                        if (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= page - 2 && pageNum <= page + 2)
                        ) {
                          return (
                            <Link
                              key={pageNum}
                              href={pageNum === 1 ? "/" : `/?page=${pageNum}`}
                              className={`h-9 w-9 flex items-center justify-center text-sm font-medium rounded-full transition-colors ${
                                pageNum === page
                                  ? "bg-cyan-700 text-white"
                                  : "text-gray-600 hover:bg-cyan-50 hover:text-cyan-700"
                              }`}
                            >
                              {pageNum}
                            </Link>
                          );
                        } else if (
                          pageNum === page - 3 ||
                          pageNum === page + 3
                        ) {
                          return (
                            <span
                              key={pageNum}
                              className="h-9 w-9 flex items-center justify-center text-gray-400"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      },
                    )}
                  </div>

                  {page < totalPages && (
                    <Link
                      href={`/?page=${page + 1}`}
                      className="px-4 py-2 text-sm font-medium text-cyan-700 rounded-full hover:bg-cyan-50 transition-colors"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              </div>

              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {skip + 1}-{Math.min(skip + itemsPerPage, totalCount)}{" "}
                of {totalCount} press releases
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
