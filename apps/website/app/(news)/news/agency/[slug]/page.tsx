import Image from "next/image";
import Link from "next/link";
import SearchInput from "@/components/search";
import { db, eq, and, lte, desc, releases, userProfiles } from "@/lib/db";
import { Metadata } from "next";

import { newsUrl, removeHtmlTags } from "@/lib/utils";

import { PressRelease } from "@/types/Release";

import { notFound } from "next/navigation";
import TrustedDialog from "@/components/trusted";
import { AgencyNewsCards } from "@/components/news_agency_card";
import SeeYourNews from "@/components/see_your_news";
import { headers } from "next/headers";
import { FeedStatsType } from "@/types/Stats";
import { postESGeneric } from "@/lib/elastic";

type Props = {
  params: Promise<{ slug: string }>;
};

export const revalidate = 0;
interface UserProfile {
  id: number;
  userId: number;
  acctHandle: string;
  acctName: string;
  acctPromo: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // read route params
  const { slug } = await params;

  const agency = await db.query.userProfiles.findFirst({
    columns: {
      id: true,
      userId: true,
      acctHandle: true,
      acctName: true,
      acctPromo: true,
    },
    where: eq(userProfiles.acctHandle, slug),
  });

  if (!agency) {
    return notFound();
  }

  return {
    title: `These press releases are managed on behalf of ${agency.acctName}`,
    description: removeHtmlTags(agency.acctPromo!),
  };
}

export default async function AgencyNews({ params }: Props) {
  const { slug } = await params;
  const currentDatetime = new Date();
  const oneHourAgo = new Date(currentDatetime.getTime() - 60 * 60 * 1000);

  const agency = await db.query.userProfiles.findFirst({
    columns: {
      id: true,
      userId: true,
      acctHandle: true,
      acctName: true,
      acctPromo: true,
    },
    where: eq(userProfiles.acctHandle, slug),
  });

  if (!agency) {
    return notFound();
  }

  const current_releases = (await db.query.releases.findMany({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      companyId: true,
      uuid: true,
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
      eq(releases.userId, agency.userId),
      lte(releases.releasedAt, currentDatetime),
      lte(releases.approvedAt, currentDatetime),
    ),
    orderBy: desc(releases.releasedAt),
    limit: 30,
  })) as PressRelease[] | null;

  if (!current_releases) {
    return notFound();
  }

  const release_list = current_releases;
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

  let platform = null;
  if (user_platform) {
    platform = user_platform.replace(/"/g, "");
  }

  const stats: FeedStatsType = {
    feed_type: "ws-frontpage",
    created_at: currentDatetime,
    category: slug,
    request_ip: visitor_ip,
    user_agent: visitor_ua,
    referrer: referrer,
    user_platform: platform,
    pr_ids: releaseIds,
    pr_uuids: releaseUuids,
    feed_url: visitor_path,
  };

  postESGeneric(stats, "nw_feedstats");

  return (
    <div className="mx-auto w-full pb-10">
      <div>
        <div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl mt-5 px-5 lg:px-0">
          <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
            <div className="lg:col-span-2">
              <a href="/" className="md:text-lg text-sky-700 hover:underline">
                Latest News
              </a>
              <div className="mb-5 md:px-0">
                <div className="pb-2">
                  <h1 className="text-4xl font-bold pb-2 pt-3">
                    {agency.acctName}
                  </h1>
                  <div
                    className="prose prose-a:text-sky-600 max-w-none"
                    dangerouslySetInnerHTML={{ __html: agency.acctPromo! }}
                  />
                </div>
                <hr />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-10">
                {release_list.map((release) => (
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
