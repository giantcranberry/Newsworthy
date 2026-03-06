import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db, eq, and, desc, asc, lte, releases, company, contact, banners, images, releaseImages, releaseCategories, category, tinyUrl, blockchain, aiVideos, aiJobs, translations } from '@/lib/db';
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
import { ImageCarousel } from "@/components/image-carousel";
import PortraitVideoPlayer from "@/components/portrait_video_player";
import MediaPlacements from "@/components/media_placements";
import DownloadPdfButton from "@/components/download-pdf-button";
import { InstagramEmbed } from "@/components/instagram-embed";
import { SkeletonImage } from "@/components/skeleton-image";
import { SkeletonNextImage } from "@/components/skeleton-next-image";

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
      releaseImages: {
        orderBy: [asc(releaseImages.sortOrder)],
        with: {
          image: {
            columns: {
              id: true,
              url: true,
              title: true,
              caption: true,
              imgCredits: true,
            },
          },
        },
      },
      faqs: {
        columns: {
          question: true,
          answer: true,
          sortOrder: true,
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

  // Build carousel images from releaseImages, fall back to primaryImage
  let carouselImages = (release.releaseImages || [])
    .filter((ri: any) => ri.image)
    .map((ri: any) => ({
      id: ri.image.id,
      url: ri.image.url.replace("RESIZE/", ""),
      title: ri.image.title,
      caption: ri.image.caption,
      imgCredits: ri.image.imgCredits,
    }));

  if (carouselImages.length === 0 && release.primaryImage?.url) {
    carouselImages = [{
      id: 0,
      url: release.primaryImage.url.replace("RESIZE/", ""),
      title: null,
      caption: release.primaryImage.caption ?? null,
      imgCredits: release.primaryImage.imgCredits ?? null,
    }];
  }

  // Banner URL for hero
  const bannerUrl = release.banner?.cdnUrl?.replace("resize=width:328", "resize=width:1400") ?? null;

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
    <>
    <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mb-5 lg:my-10 px-5">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
      <article className="lg:col-span-3 flex flex-col gap-6 w-full">
        {/* Social Banner */}
        {bannerUrl && (
          <div className="bg-gray-100 max-h-[600px] overflow-hidden rounded-lg aspect-[1200/630]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerUrl}
              alt="Social banner"
              className="w-full h-full object-cover object-top"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        )}
        {/* Byline */}
        <div className="flex flex-col gap-3">
          <h1 className="font-serif font-normal text-2xl lg:text-4xl leading-tight">
            {release.title}
          </h1>

          <p className="text-lg md:text-xl text-gray-600 font-light leading-relaxed">{release.abstract}</p>

          {/* Category pills */}
          {getCategoryData(release.releaseCategories || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {getCategoryData(release.releaseCategories || []).map((category) => (
                <Link
                  key={`cat-pill-${category.slug}`}
                  href={`/news/beat/${category.slug}`}
                  className="text-xs font-medium px-3 py-1 rounded-full bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <hr className="border-gray-200" />

        {/* Audio player & language links */}
        {(ai_media?.aprS3 || fr_link || es_link) && (
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {ai_media?.aprS3 && (
            <audio
              className="max-w-full w-[428px] h-[50px] border border-slate-300 rounded-full"
              controls
              src={ai_media.aprS3}
            />
          )}
          {(fr_link || es_link) && (
            <div className="flex gap-4">
              {fr_link && (
                <Link className="text-sm text-sky-600 hover:underline" href={fr_link}>
                  Français
                </Link>
              )}
              {es_link && (
                <Link className="text-sm text-sky-600 hover:underline" href={es_link}>
                  Español
                </Link>
              )}
            </div>
          )}
        </div>
        )}

        {/* Podcast, Social Media, and PDF Download Section */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          {firstPodcast && (
            <Link
              href={`https://newsramp.com/podcast/episode/${firstPodcast.episode_md5}`}
              target="_blank"
              className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-pink-500 text-white rounded-full pl-4 pr-6 py-3 hover:from-indigo-700 hover:to-pink-600 transition-all shadow-sm group"
            >
              <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 289 289" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M271.397 174.215C279.018 176 283.815 183.655 281.293 191.064C274.958 209.676 264.873 226.848 251.609 241.495C235.166 259.653 214.377 273.332 191.195 281.248C168.012 289.163 143.198 291.056 119.084 286.747C94.9692 282.438 72.3459 272.07 53.3394 256.616C34.3329 241.161 19.5672 221.129 10.4295 198.401C1.29191 175.672 -1.91766 150.994 1.10241 126.684C4.12247 102.375 13.273 79.232 27.6943 59.4304C39.327 43.4577 54.0812 30.082 71.0091 20.0829C77.7478 16.1024 86.2208 19.2373 89.5223 26.3334C92.8238 33.4294 89.6891 41.7873 83.0476 45.9278C70.4334 53.792 59.4072 64.0289 50.6045 76.1157C39.0118 92.0334 31.6561 110.637 29.2283 130.179C26.8006 149.72 29.3807 169.558 36.7261 187.829C44.0715 206.099 55.9411 222.202 71.2196 234.625C86.4982 247.048 104.684 255.383 124.069 258.847C143.454 262.31 163.401 260.789 182.036 254.426C200.671 248.063 217.383 237.067 230.601 222.47C240.638 211.387 248.41 198.504 253.536 184.551C256.234 177.205 263.777 172.431 271.397 174.215Z" fill="white"/>
                <path d="M222.277 157.498C229.703 157.498 235.818 151.45 234.796 144.095C233.415 134.167 230.506 124.481 226.146 115.385C219.84 102.23 210.661 90.6408 199.276 81.4614C187.891 72.282 174.589 65.7443 160.339 62.325C150.446 59.951 140.269 59.1219 130.17 59.8429C122.793 60.3696 118.154 67.5715 119.689 74.8064C121.218 82.0166 128.317 86.4955 135.686 86.3379C141.842 86.2063 148.008 86.864 154.029 88.3088C164.389 90.7945 174.059 95.5474 182.335 102.221C190.612 108.894 197.285 117.319 201.869 126.882C204.507 132.384 206.414 138.183 207.558 144.133C208.961 151.425 214.852 157.498 222.277 157.498Z" fill="white"/>
                <path d="M275.817 144.501C283.099 144.501 289.064 138.585 288.401 131.333C286.815 114 282.106 97.0577 274.466 81.3376C264.901 61.6555 250.99 44.4031 233.783 30.8821C216.577 17.3611 196.524 7.92474 175.138 3.28509C158.057 -0.420618 140.482 -0.989081 123.265 1.569C116.062 2.6392 111.725 9.83457 113.447 16.91C115.169 23.9855 122.301 28.2471 129.524 27.3238C142.834 25.6225 156.37 26.1975 169.547 29.0561C187.03 32.8491 203.423 40.5633 217.49 51.6168C231.556 62.6703 242.929 76.7743 250.748 92.8645C256.642 104.991 260.402 118.007 261.896 131.343C262.708 138.579 268.535 144.501 275.817 144.501Z" fill="white"/>
                <path d="M170.34 144.39C170.34 158.723 158.721 170.341 144.389 170.341C130.056 170.341 118.438 158.723 118.438 144.39C118.438 130.058 130.056 118.439 144.389 118.439C158.721 118.439 170.34 130.058 170.34 144.39Z" fill="white"/>
              </svg>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-white leading-none font-medium antialiased">Listen on</span>
                <span className="text-base font-bold leading-tight antialiased">NewsRamp Podcast</span>
              </div>
            </Link>
          )}
          <div className="flex items-center gap-2">
              {siteMeta && siteMeta.reddit && (
                <Link href={siteMeta.reddit} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="Reddit">
                  <Image src="https://cdn1.newsworthy.ai/reddit.svg" alt="Reddit" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.linkedin && (
                <Link href={siteMeta.linkedin} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="LinkedIn">
                  <Image src="https://cdn1.newsworthy.ai/linkedin.svg" alt="LinkedIn" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.x && (
                <Link href={siteMeta.x} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="X">
                  <Image src="https://cdn1.newsworthy.ai/twitter-x.svg" alt="X" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.mastodon && (
                <Link href={siteMeta.mastodon} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="Mastodon">
                  <Image src="https://cdn1.newsworthy.ai/mastodon.svg" alt="Mastodon" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.bluesky && (
                <Link href={siteMeta.bluesky} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="Bluesky">
                  <Image src="https://cdn1.newsworthy.ai/bluesky.svg" alt="Bluesky" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.substack && siteMeta.feed_item_id > 2500 && (
                <Link href={`${siteMeta.substack}${siteMeta.md5_permalink}`} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="Substack">
                  <Image src="https://cdn1.newsworthy.ai/substack.svg" alt="Substack" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.telegram && (
                <Link href={siteMeta.telegram} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="Telegram">
                  <Image src="https://cdn1.newsworthy.ai/telegram.svg" alt="Telegram" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              {siteMeta && siteMeta.github && (
                <Link href={siteMeta.github} target="_blank" className="p-2 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors" title="GitHub">
                  <Image src="https://cdn1.newsworthy.ai/github.svg" alt="GitHub" width={24} height={24} className="w-[24px] h-[24px]" />
                </Link>
              )}
              <div className="w-px h-5 bg-gray-200 mx-1" />
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

        <TldrComponent
          url={`https://cdn.newsramp.net/tldr/${release.prhashId}.json`}
        />

        <div>
          <p className="text-base mb-3">{dateline.replace("\u2014", "").trim()}</p>

          {/* Image carousel + pullquote floated right */}
          {(carouselImages.length > 0 || release.pullquote) && (
            <div className="w-full md:float-right md:ml-5 md:mb-4 md:w-[45%] md:max-w-[350px]">
              {carouselImages.length > 0 && (
                <ImageCarousel images={carouselImages} />
              )}
              {release.pullquote && (
                <blockquote className="mt-4 border-l-4 border-cyan-700 bg-gray-50 italic text-gray-700 px-4 py-3 text-sm">
                  <p>{release.pullquote}</p>
                </blockquote>
              )}
            </div>
          )}

          <Article htmlContent={htmlContent} pullquote={release.pullquote} />

          {release.landingPage &&
            (/\[.*?\]\s?(http\S+)/.test(release.landingPage) ? (
              <div
                className="mt-3 clear-both"
                dangerouslySetInnerHTML={{
                  __html: transformLink(release.landingPage),
                }}
              />
            ) : (
              <Link
                href={release.landingPage}
                className="mt-3 text-sky-600 hover:underline clear-both block"
              >
                Additional Information
              </Link>
            ))}

          {/* FAQs */}
          {release.faqs && release.faqs.length > 0 && (
            <div className="border-t border-gray-200 pt-5 mt-5 clear-both">
              <h3 className="font-semibold text-lg mb-3">Frequently Asked Questions</h3>
              <dl className="space-y-3">
                {[...release.faqs].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((faq: any, i: number) => (
                  <div key={i}>
                    <dt className="font-medium text-sm">{faq.question}</dt>
                    <dd className="text-gray-600 mt-1 text-sm">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="my-5 flex flex-col gap-5 clear-both">
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
      <aside className="lg:col-span-1">
        <div className="w-full flex flex-col gap-6">
          {/* QR Code */}
          <Link href={qrcode_landing} target="_blank" className="block">
            <SkeletonImage
              src={qrcode_url}
              alt="QrCode for Blockchain Registration Graphic"
              className="w-full aspect-auto"
              width={350}
              height={350}
              style={{ width: "100%", height: "auto" }}
              wrapperClassName="w-full aspect-square"
              skeletonClassName="w-full h-full rounded"
              loading="eager"
              fetchPriority="high"
            />
          </Link>

          {/* Company info */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex justify-center p-6">
              {release.company?.logoUrl ? (
                <SkeletonNextImage
                  className="rounded max-h-[80px] w-auto"
                  src={company_logo_url}
                  width={250}
                  height={80}
                  alt={release.company.companyName}
                  wrapperClassName="h-[80px]"
                  skeletonClassName="rounded w-[160px] h-full"
                />
              ) : (
                <h4 className="text-lg font-semibold text-center">
                  {release.company?.companyName}
                </h4>
              )}
            </div>
            <div className="flex flex-col divide-y divide-gray-200 border-t border-gray-200">
            {release.company?.phone &&
              release.company.phone !== "1111111111" &&
              release.company.phone !== "111-111-1111" && (
                <Link
                  href={`tel:${release.company?.phone}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-500">Phone</span>
                  <span className="text-sky-600">{release.company?.phone}</span>
                </Link>
              )}
            {release.company?.website && (
              <Link
                href={release.company?.website}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                target="_blank"
              >
                <span className="text-gray-500">Website</span>
                <span className="text-sky-600 flex items-center gap-1">{new URL(release.company.website).hostname} <ExternalLink size={12} /></span>
              </Link>
            )}
            {release.company.nrUri && (
              <Link
                href={`https://newsworthy.ai/newsroom/${release.company.nrUri}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="text-gray-500">Newsroom</span>
                <span className="text-sky-600 flex items-center gap-1">Visit <ExternalLink size={12} /></span>
              </Link>
            )}
            {release.publicDrive && (
              <Link
                href={release.publicDrive}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                target="_blank"
              >
                <span className="text-gray-500">Media Assets</span>
                <span className="text-teal-600 flex items-center gap-1">
                  <Image
                    src={getImageFromUrl(release.publicDrive)}
                    className="w-[14px] h-[14px]"
                    alt=""
                    width={14}
                    height={14}
                  />
                  Download <ExternalLink size={12} />
                </span>
              </Link>
            )}
            </div>
          </div>

          {/* Videos */}
          {ai_media?.ltiMp4S3 && (
            <video className="rounded-lg w-full" controls preload="metadata">
              <source src={ai_media?.ltiMp4S3} type="video/mp4" />
            </video>
          )}
          {release.prhashId && (
            <PortraitVideoPlayer prhashId={release.prhashId} />
          )}

          {/* Subscribe */}
          <SubscribeForm company={companyData} />

          {release.company.gmb && (
            <GoogleMyBusiness company={release.company} />
          )}
          {release.prhashId && (
            <MediaPlacements prhashId={release.prhashId} />
          )}
        </div>
      </aside>
      </div>
    </div>
    </>
  );
}
