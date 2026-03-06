import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, eq, and, desc, lte, releases, company, contact, banners, images, releaseCategories, category, tinyUrl, blockchain, aiVideos, aiJobs, translations } from '@/lib/db';
import {
  getDateline,
  newsTranslatedUrl,
  newsUrl,
  replaceResizeWithWidth,
  separateNewsByLanguage,
} from "@/lib/utils";
import { postESGeneric } from "@/lib/elastic";

import type { AiMedia, PressRelease, QrCode, Takeaways } from "@/types/Release";

import type { PageStatsType } from "@/types/Stats";

import type { subscribeFormSchemaType } from "@/types/Forms"; // This type is in Forms.ts

import type { TranslatedNews } from "@/types/TranslatedNews"; // This type is in TranslatedNews.ts

import type {
  SiteMetaJson,
  SiteMetaData,
  PodcastMeta,
  PodcastEpisode,
} from "@/types/Meta";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SubscribeForm from "@/components/forms/subscribe_form";
import GoogleMyBusiness from "@/components/google_my_business";
import TldrComponent from "@/components/tldr_newsramp";
import Article from "@/components/article";
import PortraitVideoPlayer from "@/components/portrait_video_player";
import MediaPlacements from "@/components/media_placements";
import DownloadPdfButton from "@/components/download-pdf-button";
import { InstagramEmbed } from "@/components/instagram-embed";

// Embed detection
type EmbedInfo =
  | { type: 'youtube'; embedUrl: string }
  | { type: 'instagram'; url: string }
  | null

function getEmbedInfo(url: string): EmbedInfo {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: 'youtube', embedUrl: `https://youtube.com/embed/${ytMatch[1]}` }

  const igMatch = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) return { type: 'instagram', url: `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/` }

  return null
}

// Constants
const IMAGE_MAP: Record<string, string> = {
  "google.com": "https://cdn1.newsworthy.ai/images/icons/google-drive-icon.png",
  "dropbox.com": "https://cdn1.newsworthy.ai/images/icons/dropbox-icon.png",
  "box.com": "https://cdn1.newsworthy.ai/images/icons/box-icon.png",
};

const DEFAULT_ICON = "https://cdn1.newsworthy.ai/images/icons/default-icon.png";

// Types
type SearchParams = {
  utm_source?: string;
};

type Props = {
  params: Promise<{
    slug: string;
    id_string: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type Tiny = {
  id: number;
  url: string | null;
  cohort: string | null;
  influencerId: number | null;
};

// Utility functions
function removeEmptyPTags(html: string): string {
  return html.replace(/<p>\s*<\/p>/g, "");
}

function transformLink(url: string): string {
  const regex = /\[(.*?)\]\s?(http\S+)/;
  const matches = regex.exec(url);
  if (matches) {
    const [, keyword, actualUrl] = matches;
    return `<a href="${actualUrl}" class="text-sky-600 hover:underline">${keyword}</a>`;
  }
  return url;
}

function getImageFromUrl(url: string): string {
  for (const [domain, image] of Object.entries(IMAGE_MAP)) {
    if (url.includes(domain)) return image;
  }
  return DEFAULT_ICON;
}

async function getSiteMeta(pr_hashid: string): Promise<SiteMetaJson | null> {
  const response = await fetch(`https://cdn.newsramp.net/meta/${pr_hashid}`);
  console.log(`https://cdn.newsramp.net/meta/${pr_hashid}`);
  if (!response.ok) return null;

  const data: SiteMetaData = await response.json();
  return JSON.parse(data.meta_json);
}

export const revalidate = 14400; // 4 hours

export async function generateMetadata({
  searchParams,
  params,
}: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const pr_id = parseInt(resolvedParams.id_string.substring(8));

  const release = await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      uuid: true,
      companyId: true,
      slug: true,
      releasedAt: true,
      timezone: true,
      abstract: true,
    },
    with: {
      company: {
        columns: {
          companyName: true,
          logoUrl: true,
          website: true,
          city: true,
          state: true,
          phone: true,
        },
      },
      banner: {
        columns: {
          cdnUrl: true,
        },
      },
    },
    where: and(eq(releases.isDeleted, false), eq(releases.id, pr_id)),
  });

  if (!release) return notFound();

  const cdn_url =
    release.banner?.cdnUrl!.replace(
      "resize=width:328",
      "resize=width:1200"
    ) ?? "";

  const canonicalURL = newsUrl(release);

  return {
    metadataBase: new URL("https://newsworthy.ai"),
    title: release.title,
    description: release.abstract,
    openGraph: {
      title: release.title!,
      description: release.abstract!,
      images: [
        { url: cdn_url, width: 1200, height: 630 },
        { url: cdn_url, width: 1200, height: 675 },
        { url: cdn_url, width: 800, height: 418 },
        { url: cdn_url, width: 300, height: 157 },
      ],
    },
    alternates: {
      canonical: `https://newsworthy.ai${canonicalURL}`,
    },
    twitter: {
      card: "summary_large_image",
      title: release.title!,
      description: release.abstract!,
      creator: "@NewsworthyAI",
      images: [cdn_url],
    },
  };
}

export default async function PressRelease({ searchParams, params }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const pr_id = parseInt(resolvedParams.id_string.substring(8));
  const utm_source = resolvedSearchParams?.utm_source || "";
  const currentDatetime = new Date();

  // Fetch press release data
  const release = await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      uuid: true,
      companyId: true,
      userId: true,
      slug: true,
      releasedAt: true,
      releaseAt: true,
      timezone: true,
      status: true,
      body: true,
      abstract: true,
      landingPage: true,
      pullquote: true,
      location: true,
      publicDrive: true,
      prhashId: true,
      isFeatured: true,
      videoUrl: true,
    },
    with: {
      company: {
        columns: {
          companyName: true,
          uuid: true,
          logoUrl: true,
          website: true,
          city: true,
          state: true,
          phone: true,
          gmb: true,
          nrUri: true,
        },
      },
      primaryContact: {
        columns: {
          name: true,
          title: true,
          email: true,
          phone: true,
        },
      },
      banner: {
        columns: {
          cdnUrl: true,
        },
      },
      primaryImage: {
        columns: {
          url: true,
          caption: true,
          imgCredits: true,
        },
      },
      releaseCategories: {
        with: {
          category: {
            columns: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    where: and(eq(releases.isDeleted, false), eq(releases.id, pr_id)),
  });

  if (!release) return notFound();

  // Process company logo
  const company_logo_url = release.company?.logoUrl
    ? replaceResizeWithWidth(release.company.logoUrl, 400)
    : "";

  // Get dateline
  const dateline = getDateline(
    release.releaseAt,
    release.location ?? "Unknown Location",
    release.timezone ?? "Unknown Timezone"
  );

  // Fetch recent releases
  const recent = await db.query.releases.findMany({
    limit: 6,
    offset: 1,
    columns: {
      id: true,
      title: true,
      selfHost: true,
      slug: true,
      releasedAt: true,
      releaseAt: true,
      timezone: true,
      status: true,
      abstract: true,
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.companyId, release.companyId),
      lte(releases.releasedAt, new Date())
    ),
    orderBy: desc(releases.releasedAt),
  });

  // Handle stats
  const headersList = await headers();
  const stats: PageStatsType = {
    created_at: currentDatetime,
    request_ip:
      headersList.get("x-forwarded-for") || headersList.get("remote_addr"),
    user_agent: headersList.get("user-agent"),
    referrer: headersList.get("referer"),
    user_platform:
      headersList.get("sec-ch-ua-platform")?.replace(/"/g, "") ?? null,
    pr_id: release.id,
    pr_uuid: release.uuid,
    pr_url: `https://newsworthy.ai${newsUrl(release)}`,
    pr_company_id: release.companyId,
    pr_user_id: release.userId,
    pr_released_at: release.releasedAt,
  };

  await postESGeneric(stats, "nw_pageviews");

  // Handle share stats
  if (utm_source) {
    const tiny = await db.query.tinyUrl.findFirst({
      columns: {
        id: true,
        url: true,
        cohort: true,
        influencerId: true,
      },
      where: eq(tinyUrl.prId, pr_id),
    });

    const cleanNewsUrl = tiny?.url ? tiny.url.split("?")[0] : "";

    const share_stats = {
      created_at: currentDatetime,
      request_ip: stats.request_ip,
      user_agent: stats.user_agent,
      referrer: stats.referrer,
      company_id: release.companyId,
      pr_url: cleanNewsUrl,
      pr_id: release.id,
      user_id: release.userId,
      cohort: tiny?.cohort ?? "",
    };

    await postESGeneric(share_stats, "nw_shares");
  }

  // Check blockchain redirect
  const bc = await db.query.blockchain.findFirst({
    where: eq(blockchain.prid, pr_id),
  });

  if (bc?.selfHostDomain && bc.redirectUrl?.includes(bc.selfHostDomain)) {
    redirect(bc.redirectUrl);
  }

  // Fetch additional data
  const [ai_media, translatedPRs, qrcode, ai_content, siteMeta] =
    (await Promise.all([
      db.query.aiVideos.findFirst({
        columns: {
          id: true,
          prId: true,
          aprS3: true,
          ltiMp4S3: true,
        },
        where: and(eq(aiVideos.isDeleted, false), eq(aiVideos.prId, pr_id)),
      }),

      db.query.translations.findMany({
        limit: 2,
        columns: {
          id: true,
          prId: true,
          title: true,
          abstract: true,
          prUuid: true,
          body: true,
          pullquote: true,
          languageCode: true,
          releaseAt: true,
          slug: true,
          links: true,
        },
        where: eq(translations.prId, release.id),
      }),

      db.query.blockchain.findFirst({
        columns: { qrcode: true },
        where: eq(blockchain.prid, pr_id),
      }),

      db.query.aiJobs.findFirst({
        columns: {
          takeaway1: true,
          takeaway2: true,
          takeaway3: true,
        },
        where: eq(aiJobs.prId, pr_id),
      }),

      release.prhashId ? getSiteMeta(release.prhashId) : null,
    ])) as [
      AiMedia | null,
      TranslatedNews[],
      QrCode | null,
      Takeaways | null,
      SiteMetaJson | null,
    ];

  // Now TypeScript knows exactly what type translatedPRs is
  const separatedNews = separateNewsByLanguage(translatedPRs);

  const es_pr = separatedNews["es"]?.[0];
  const fr_pr = separatedNews["fr"]?.[0];

  const fr_link = fr_pr ? newsTranslatedUrl(fr_pr) : "";
  const es_link = es_pr ? newsTranslatedUrl(es_pr) : "";

  // Process QR code
  const qrcode_url =
    release.id >= 950
      ? `https://cdn.newsramp.net/qrcode/${release.prhashId}.webp`
      : `https://cdn.newsworthy.ai/images/${qrcode?.qrcode}/${release.uuid}_bco.png`;

  const qrcode_landing =
    release.id >= 950
      ? `https://newsramp.com/blockchain/txn_detail/${release.prhashId}`
      : `/blockchain/txn-detail/${release.uuid}`;

  // Process content
  const htmlContent = removeEmptyPTags(release.body!);
  const newsImage = release.primaryImage?.url.replace("RESIZE/", "");
  const imageCaption = release.primaryImage?.caption ?? null;
  const imageCredit = release.primaryImage?.imgCredits ?? null;

  const companyData: subscribeFormSchemaType = {
    id: release.company.uuid,
    company: release.company.companyName,
  };

  const firstPodcast = siteMeta?.podcasts?.[0];

  function getCategoryData(
    categories: Array<{ category: { name?: string; slug?: string } | null }>
  ) {
    return categories
      .map((cat) => cat.category)
      .filter(
        (cat): cat is { name: string; slug: string } =>
          cat !== null &&
          typeof cat?.name === "string" &&
          typeof cat?.slug === "string"
      );
  }

  return (
    <div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl grid grid-cols-1 lg:grid-flow-col gap-10 mb-5 lg:my-10 px-5">
      <article className="col-span-2 lg:col-span-2 flex flex-col items gap-5 w-full">
        {/* Main content section */}
        <div className="flex flex-col md:flex-row lg:flex-row md:gap-10 lg:flex-wrap xl:flex-nowrap lg:justify-between lg:items-end">
          <div className="flex xl:flex xl:items-center xl:justify-between xl:gap-10">
            <div className="flex gap-32 justify-between">
              {ai_media?.aprS3 && (
                <div>
                  <audio
                    className="mt-5 lg:mt-0 max-w-full w-[428px] h-[50px] border border-slate-400 rounded-full"
                    controls
                    src={ai_media.aprS3}
                  />
                </div>
              )}
            </div>
            <div className="flex pt-5 gap-5">
              {fr_link && (
                <Link
                  className="text-base text-sky-600 hover:underline"
                  href={fr_link}
                >
                  Lisez-le en Français (French)
                </Link>
              )}
              {es_link && (
                <Link
                  className="text-base text-sky-600 hover:underline"
                  href={es_link}
                >
                  Léelo en Español (Spanish)
                </Link>
              )}
            </div>
          </div>
        </div>

        <h1 className="font-serif font-medium text-2xl lg:text-4xl">
          {release.title}
        </h1>

        {/* Podcast, Social Media, and PDF Download Section */}
        <div className="flex justify-between items-center flex-wrap gap-7 md:gap-0">
          {firstPodcast && (
            <div className="flex gap-1 md:gap-3 items-center flex-wrap">
              <p className="text-base">This News was Featured on</p>
              <Link
                className="transition ease-in-out duration-300 hover:translate-x-0.5"
                href={`https://newsramp.com/podcast/episode/${firstPodcast.episode_md5}`}
              >
                <Image
                  src="https://cdn.newsramp.app/badges/listen-now-podcast.svg"
                  alt="This news story was featured on a podcast in the NewsRamp Podcast Series. Listen here."
                  width={120}
                  height={1}
                />
              </Link>
            </div>
          )}
          <div className="flex items-center gap-3 border border-slate-300 rounded-full bg-slate-100 py-2 px-3">
            {siteMeta && siteMeta.reddit && (
              <>
                <p className="text-lg font-normal">View This News On</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link
                        href={siteMeta.reddit}
                        className="flex items-center justify-start gap-3"
                        target="_blank"
                      >
                        <Image
                          src={`https://cdn1.newsworthy.ai/reddit.svg`}
                          className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                          alt="Reddit"
                          width={28}
                          height={28}
                        />{" "}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Engage on Reddit</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {siteMeta && siteMeta.linkedin && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.linkedin}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/linkedin.svg`}
                        alt="Linkedin"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on LinkedIn</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.x && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.x}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/twitter-x.svg`}
                        alt="X.com"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on X formerly known as Twitter</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.mastodon && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.mastodon}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/mastodon.svg`}
                        alt="mastodon"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on Mastodon</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.bluesky && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.bluesky}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/bluesky.svg`}
                        alt="bluesky"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on Bluesky</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.substack && siteMeta.feed_item_id > 2500 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={`${siteMeta.substack}${siteMeta.md5_permalink}`}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src="https://cdn1.newsworthy.ai/substack.svg"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        alt="Substack"
                        width={28}
                        height={28}
                      />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This Story and More at Substack</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.telegram && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.telegram}
                      target="_blank"
                      className="flex items-center justify-start gap-3"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/telegram.svg`}
                        alt="Telegram"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on Telegram</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {siteMeta && siteMeta.github && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link
                      href={siteMeta.github}
                      className="flex items-center justify-start gap-3"
                      target="_blank"
                    >
                      <Image
                        src={`https://cdn1.newsworthy.ai/github.svg`}
                        alt="GitHub"
                        className="rounded w-7 h-7 transition ease-in-out delay-100 hover:-translate-y-1 hover:scale-110 duration-300"
                        width={28}
                        height={28}
                      />{" "}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Engage on GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <DownloadPdfButton
              idString={resolvedParams.id_string}
              slug={resolvedParams.slug}
            />
          </div>
        </div>

        {release.videoUrl && (() => {
          const embed = getEmbedInfo(release.videoUrl)
          if (embed?.type === 'youtube') return (
            <div className="flex justify-center">
              <iframe
                title="Embedded video"
                src={embed.embedUrl}
                className="aspect-video w-full h-[200px] md:h-[400px] lg:w-[600px] lg:h-[350px] rounded"
                loading="lazy"
                allowFullScreen
              ></iframe>
            </div>
          )
          if (embed?.type === 'instagram') return (
            <InstagramEmbed url={embed.url} />
          )
          return null
        })()}

        <p className="text-base md:text-xl font-light">{release.abstract}</p>
        <TldrComponent
          url={`https://cdn.newsramp.net/tldr/${release.prhashId}.json`}
        />

        <div>
          <div className="flex mb-3">
            <p>{dateline.replace("\u2014", "")}</p>
          </div>

          <Article
            htmlContent={htmlContent}
            newsImage={newsImage}
            pullQuote={release.pullquote}
            imageCaption={imageCaption}
            imageCredit={imageCredit}
          />

          {release.landingPage &&
            (/\[.*?\]\s?(http\S+)/.test(release.landingPage) ? (
              <div
                className="mt-3"
                dangerouslySetInnerHTML={{
                  __html: transformLink(release.landingPage),
                }}
              />
            ) : (
              <Link
                href={release.landingPage}
                className="mt-3 text-sky-600 hover:underline"
              >
                Additional Information
              </Link>
            ))}

          <div className="my-5 flex flex-col gap-5">
            <div>
              <h3 className="font-medium text-lg">
                Media Contact for {release.company.companyName}
              </h3>
              <hr />
              {release.primaryContact && (
                <div className="pt-2">
                  <h4 className="text-lg">{release.primaryContact.name}</h4>
                  <p className="text-sm">{release.primaryContact.phone}</p>
                  <p className="text-sm">{release.primaryContact.email}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-lg">Filed Under</h3>
              <hr />
              <ul className="flex flex-wrap gap-x-7 ml-5 pt-2">
                {getCategoryData(release.releaseCategories || []).map(
                  (category) => (
                    <li className="list-disc" key={`category-${category.slug}`}>
                      <Link
                        className="hover:underline hover:text-sky-600"
                        href={`/news/beat/${category.slug}`}
                      >
                        {category.name}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
            {recent && recent.length > 0 ? (
              <div>
                <h3 className="font-medium text-lg">
                  Other Recent News for {release.company.companyName}
                </h3>
                <hr />
                <ul className="ml-5 pt-2">
                  {recent.map((recent) => (
                    <li className="list-disc" key={`recent-${recent.id}`}>
                      <Link
                        className="hover:underline hover:text-sky-600"
                        href={newsUrl(recent)}
                      >
                        {recent?.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="prose prose-p:text-base mt-5">
                <p>
                  <span className="font-semibold">
                    {release.company.companyName}
                  </span>{" "}
                  does not have any other recent news to report at this time.
                </p>
              </div>
            )}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: release.title,
              image: {
                "@type": "ImageObject",
                url:
                  release.banner?.cdnUrl?.replace(
                    "resize=width:328",
                    "resize=width:1200"
                  ) ?? "",
                width: 1200,
                height: 630,
              },
              datePublished: release.releasedAt?.toISOString(),
              dateModified: release.releasedAt?.toISOString(),
              author: {
                "@type": "Organization",
                name: release.company.companyName,
              },
              publisher: {
                "@type": "Organization",
                name: "Newsworthy.ai",
                logo: {
                  "@type": "ImageObject",
                  url: "https://newsworthy.ai/logo.png",
                  width: 600,
                  height: 60,
                },
              },
              description: release.abstract,
              mainEntityOfPage: {
                "@type": "WebPage",
                "@id": `https://newsworthy.ai${newsUrl(release)}`,
              },
            }),
          }}
        />
      </article>
      <div className="col-span-2 lg:col-span-1">
        <div className="w-full md:max-w-[300px] lg:max-w-[350px]">
          <Link href={qrcode_landing} target="_blank">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrcode_url}
              alt="QrCode for Blockchain Registration Graphic"
              className="w-full md:w-[360px] aspect-auto mb-5 md:mb-0"
              width={360}
              height={360}
              style={{ width: "100%", height: "auto" }}
            />
          </Link>

          <div className="my-5">
            {release.company?.logoUrl && (
              <Image
                className="rounded my-3"
                src={company_logo_url}
                width={150}
                height={1}
                alt={`company logo for: ${release.company.companyName}`}
              />
            )}
            <h4 className="pt-3 text-xl font-semibold">
              {release.company?.companyName}
            </h4>
            <div className="flex flex-col gap-2 mt-2">
              {release.company?.phone &&
                release.company.phone !== "1111111111" &&
                release.company.phone !== "111-111-1111" && (
                  <Link
                    href={`tel:${release.company?.phone}`}
                    className="text-sky-600 hover:underline"
                  >
                    Tel. {release.company?.phone}
                  </Link>
                )}
              {release.company?.website && (
                <Link
                  href={release.company?.website}
                  className="text-sky-600 hover:underline flex gap-1 items-center"
                  target="_blank"
                >
                  Website <ExternalLink size={16} />
                </Link>
              )}
              {release.company.nrUri && (
                <Link
                  href={`https://newsworthy.ai/newsroom/${release.company.nrUri}`}
                  className="text-sky-600 hover:underline flex gap-1 items-center text-lg font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Online Newsroom <ExternalLink size={16} />
                </Link>
              )}
            </div>
          </div>
          <hr className="mt-5" />

          {release.publicDrive && (
            <>
              <div className="flex flex-col gap-1 my-5">
                <h4 className="text-lg">Additional Assets</h4>
                <Link
                  href={release.publicDrive}
                  className="text-teal-600 hover:underline flex gap-1 items-center font-semibold"
                  target="_blank"
                >
                  <Image
                    src={getImageFromUrl(release.publicDrive)}
                    className="w-[16px] h-[16px]"
                    alt=""
                    width={16}
                    height={16}
                  />{" "}
                  Public Drive <ExternalLink size={20} className="ml-1" />
                </Link>
              </div>
              <hr />
            </>
          )}

          {ai_media?.ltiMp4S3 && (
            <video className="rounded" controls>
              <source src={ai_media?.ltiMp4S3} type="video/mp4" />
            </video>
          )}
          {release.prhashId && (
            <PortraitVideoPlayer prhashId={release.prhashId} />
          )}
          {release.company.gmb && (
            <GoogleMyBusiness company={release.company} />
          )}
          <SubscribeForm company={companyData} />
          {release.prhashId && (
            <MediaPlacements prhashId={release.prhashId} />
          )}
        </div>
      </div>
    </div>
  );
}
