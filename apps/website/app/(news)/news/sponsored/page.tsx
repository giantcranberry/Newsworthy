import Image from "next/image";
import Link from "next/link";
import SearchInput from "@/components/search";
import { db, eq, and, lte, desc, releases } from "@/lib/db";

import { newsUrl } from "@/lib/utils";

import { PressRelease } from "@/types/Release";

import Influencer from "@/components/influencer_card";
import { notFound } from "next/navigation";
import TrustedDialog from "@/components/trusted";
import { AgencyNewsCards } from "@/components/news_agency_card";
import SeeYourNews from "@/components/see_your_news";
import { HorizontalNews } from "@/components/news_card";
import { Metadata } from "next";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Newsworthy.ai Sponsored News",
  description: "Newsworthy.ai, The News Marketing Platform",
};

export default async function SponsoredNews() {
  const currentDatetime = new Date();

  const current_releases = (await db.query.releases.findMany({
    limit: 30,
    columns: {
      id: true,
      title: true,
      selfHost: true,
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
      eq(releases.score, 3),
      lte(releases.releasedAt, currentDatetime),
      lte(releases.approvedAt, currentDatetime),
    ),
    orderBy: desc(releases.releasedAt),
  })) as PressRelease[] | null;

  if (!current_releases) {
    return notFound();
  }

  const releases_list = current_releases;

  return (
    <div className="mx-auto w-full pb-10">
      <div>
        <div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl mt-5 px-5 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
            <div className="lg:col-span-2">
              <div className="px-5 mb-5 md:px-0">
                <div className="flex justify-between items-baseline">
                  <h1 className="md:text-4xl font-bold pb-2">Sponsored News</h1>
                  <a
                    href="/"
                    className="md:text-lg text-sky-700 hover:underline"
                  >
                    Latest News
                  </a>
                </div>
                <hr />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10 border-b last-of-type:border-0">
                {releases_list.map((release) => (
                  <AgencyNewsCards key={release.id} release={release} />
                ))}
              </div>
            </div>
            <div className="md:col-span-2 lg:col-span-1 w-full lg:max-w-[350px] flex flex-col md:flex-row lg:flex-col gap-5 px-5 lg:px-0">
              <SeeYourNews />
            </div>
          </div>
        </div>
      </div>
      {/* <CenteredContentBand band={bands[1]} /> */}
    </div>
  );
}
