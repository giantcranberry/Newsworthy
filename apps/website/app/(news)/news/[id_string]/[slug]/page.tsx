import Image from "next/image";
import Link from "next/link";
import Script from "next/script";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { ShareButtons } from "@/components/share-buttons";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from 'crypto';
import { db, eq, ne, and, desc, asc, lte, releases, company, contact, banners, images, releaseImages, releaseCategories, category, tinyUrl, blockchain, aiVideos, aiJobs, translations, releaseEmails, releaseEvents } from '@/lib/db';
import {
  getDateline,
  newsTranslatedUrl,
  newsUrl,
  removeHtmlTags,
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
          url: true,
        },
      },
    },
    where: and(eq(releases.isDeleted, false), eq(releases.id, pr_id)),
  });

  if (!release) return notFound();

  const cdn_url = release.banner?.url ?? "";

  const canonicalURL = newsUrl(release);

  return {
    metadataBase: new URL("https://www.newsworthy.ai"),
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
      canonical: `https://www.newsworthy.ai${canonicalURL}`,
    },
    twitter: {
      card: "summary_large_image",
      title: release.title!,
      description: release.abstract!,
      creator: "@NewsworthyAI",
      images: [cdn_url],
    },
    other: {
      "syndication-source": `https://www.newsworthy.ai${canonicalURL}`,
      "original-source": `https://www.newsworthy.ai${canonicalURL}`,
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
          jsonLd: true,
          addr1: true,
          addr2: true,
          postalCode: true,
          countryCode: true,
          linkedinUrl: true,
          xUrl: true,
          facebookUrl: true,
          instagramUrl: true,
          youtubeUrl: true,
          seo: true,
        },
      },
      primaryContact: {
        columns: {
          name: true,
          title: true,
          email: true,
          phone: true,
          avatar: true,
        },
      },
      banner: {
        columns: {
          url: true,
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

  // Fetch recent releases (exclude current release)
  const recent = await db.query.releases.findMany({
    limit: 5,
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
      ne(releases.id, release.id),
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
    prhash_id: release.prhashId,
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
  const [ai_media, translatedPRs, qrcode, ai_content, siteMeta, eventData] =
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

      db.query.releaseEvents.findFirst({
        where: eq(releaseEvents.prId, pr_id),
      }),
    ])) as [
      AiMedia | null,
      TranslatedNews[],
      QrCode | null,
      Takeaways | null,
      SiteMetaJson | null,
      { startDate: Date; endDate: Date | null; location: string | null; timezone: string | null } | undefined,
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

  // Build contact email obfuscation link (same pattern as body email processing)
  let contactEmailLink: string | null = null
  if (release.primaryContact?.email) {
    const emailLower = release.primaryContact.email.toLowerCase().trim()
    const hash = createHash('md5').update(emailLower).digest('hex')

    // Ensure the hash exists in release_emails
    const existing = await db.query.releaseEmails.findFirst({
      where: eq(releaseEmails.md5Hash, hash),
    })
    if (!existing) {
      await db.insert(releaseEmails).values({
        md5Hash: hash,
        email: emailLower,
      }).onConflictDoNothing()
    }

    contactEmailLink = `https://newsworthy.email/post/${hash}-${release.id}`
  }

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
  const bannerUrl = release.banner?.url ?? null;

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

  // Build JSON-LD structured data
  const jsonLdAuthor: Record<string, unknown> = {
    "@type": "Organization",
    name: release.company.companyName,
  }
  const authorProfileUrl = `https://www.newsworthy.ai/newsroom/${release.company.nrUri || release.company.uuid}`
  jsonLdAuthor.url = authorProfileUrl
  if (release.company.jsonLd) {
    const stored = typeof release.company.jsonLd === 'string' ? JSON.parse(release.company.jsonLd) : release.company.jsonLd
    if (stored.logo) jsonLdAuthor.logo = stored.logo
    const storedSameAs = Array.isArray(stored.sameAs) ? stored.sameAs : []
    if (stored.url) storedSameAs.push(stored.url)
    if (storedSameAs.length > 0) jsonLdAuthor.sameAs = storedSameAs
  } else {
    if (release.company.logoUrl) jsonLdAuthor.logo = replaceResizeWithWidth(release.company.logoUrl, 400)
    const sameAs = [release.company.website, release.company.linkedinUrl, release.company.xUrl, release.company.facebookUrl, release.company.instagramUrl, release.company.youtubeUrl].filter(Boolean)
    if (sameAs.length > 0) jsonLdAuthor.sameAs = sameAs
  }
  if (release.primaryContact && (release.primaryContact.phone || release.primaryContact.email)) {
    const contactPoint: Record<string, string> = {
      "@type": "ContactPoint",
      contactType: "Media Contact",
    }
    if (release.primaryContact.phone) contactPoint.telephone = release.primaryContact.phone
    if (release.primaryContact.email) contactPoint.email = release.primaryContact.email
    jsonLdAuthor.contactPoint = contactPoint
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://www.newsworthy.ai${newsUrl(release)}`,
    },
    headline: release.title && release.title.length > 100 ? release.title.substring(0, 97) + '...' : release.title,
    description: release.abstract,
    image: {
      "@type": "ImageObject",
      url: release.banner?.url ?? "",
      width: 1200,
      height: 630,
    },
    datePublished: release.releasedAt?.toISOString(),
    dateModified: release.releasedAt?.toISOString(),
    isAccessibleForFree: "true",
    author: jsonLdAuthor,
    publisher: {
      "@type": "Organization",
      name: "Newsworthy.ai",
      url: "https://www.newsworthy.ai",
      logo: {
        "@type": "ImageObject",
        url: "https://www.newsworthy.ai/logo.svg",
        width: 256,
        height: 40,
      },
    },
    copyrightHolder: {
      "@type": "Organization",
      name: release.company.companyName,
    },
  }
  if (release.body) {
    jsonLd.articleBody = removeHtmlTags(release.body)
  }

  // Add Event schema if event data exists
  if (eventData) {
    jsonLd["@type"] = ["NewsArticle", "Event"]
    jsonLd.startDate = eventData.startDate.toISOString()
    if (eventData.endDate) {
      jsonLd.endDate = eventData.endDate.toISOString()
    }
    if (eventData.location) {
      jsonLd.location = {
        "@type": "Place",
        address: eventData.location,
      }
    }
    jsonLd.eventAttendanceMode = "https://schema.org/OfflineEventAttendanceMode"
  }

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd, null, 2) }}
    />
    {(() => {
      const tracking = (release.company.seo as any)?.tracking
      if (!tracking) return null
      return (
        <>
          {/* Google Tag Manager */}
          {tracking.gtmId && (
            <Script
              id="gtm-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${tracking.gtmId}');`,
              }}
            />
          )}
          {/* Google Ads remarketing */}
          {tracking.googleAdsId && (
            <>
              <Script
                strategy="afterInteractive"
                src={`https://www.googletagmanager.com/gtag/js?id=${tracking.googleAdsId}`}
              />
              <Script
                id="google-ads-gtag"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                  __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${tracking.googleAdsId}');`,
                }}
              />
            </>
          )}
          {/* Meta (Facebook) Pixel */}
          {tracking.metaPixelId && (
            <Script
              id="meta-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.metaPixelId}');fbq('track','PageView');`,
              }}
            />
          )}
          {/* Reddit Pixel */}
          {tracking.redditPixelId && (
            <Script
              id="reddit-pixel"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `!function(w,d){if(!w.rdt){var p=w.rdt=function(){p.sendEvent?p.sendEvent.apply(p,arguments):p.callQueue.push(arguments)};p.callQueue=[];var t=d.createElement("script");t.src="https://www.redditstatic.com/ads/pixel.js";t.async=!0;var s=d.getElementsByTagName("script")[0];s.parentNode.insertBefore(t,s)}}(window,document);rdt('init','${tracking.redditPixelId}');rdt('track','PageVisit');`,
              }}
            />
          )}
          {/* Microsoft Clarity */}
          {tracking.clarityId && (
            <Script
              id="clarity-script"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${tracking.clarityId}");`,
              }}
            />
          )}
          {/* HubSpot tracking */}
          {tracking.hubspotId && (
            <Script
              id="hubspot-tracking"
              strategy="afterInteractive"
              src={`https://js.hs-scripts.com/${tracking.hubspotId}.js`}
            />
          )}
        </>
      )
    })()}
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
          <p className="text-base mb-3">
            {(() => {
              const text = dateline.replace("\u2014", "").trim()
              const nwMatch = text.match(/^(.*?\()Newsworthy\.ai(\).*)$/)
              if (nwMatch) {
                return <>{nwMatch[1]}<Link href="https://www.newsworthy.ai" className="text-sky-600 hover:underline">Newsworthy.ai</Link>{nwMatch[2]}</>
              }
              return text
            })()}
          </p>

          {/* Image carousel + pullquote — floated on desktop only */}
          {(carouselImages.length > 0 || release.pullquote) && (
            <div className="hidden lg:block lg:float-right lg:ml-5 lg:mb-4 lg:w-[55%] lg:max-w-[425px]">
              {carouselImages.length > 0 && (
                <ImageCarousel images={carouselImages} />
              )}
              {release.pullquote && (
                <blockquote className="mt-4 border-l-4 border-cyan-700 bg-gray-50 italic text-gray-700 px-5 py-4 text-base leading-relaxed">
                  <p>{(() => {
                    const text = release.pullquote.trim();
                    if (/^[""\u201C]/.test(text)) return text;
                    const match = text.match(/^(.*?)\s*(--\s*|—\s*|-\s+)(.+)$/s);
                    if (match) return <>{`\u201C${match[1].trimEnd()}\u201D `}<span className="not-italic">{match[2]}{match[3]}</span></>;
                    return `\u201C${text}\u201D`;
                  })()}</p>
                </blockquote>
              )}
              <div className="flex items-center justify-end gap-1.5 mt-3">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Share</span>
                <div className="w-px h-4 bg-gray-200" />
                <ShareButtons
                  url={`https://www.newsworthy.ai${newsUrl(release)}`}
                  title={release.title}
                  abstract={release.abstract}
                  compact
                />
              </div>
            </div>
          )}

          <Article
            htmlContent={htmlContent}
            insertAfterParagraph={2}
            insertContent={
              (carouselImages.length > 0 || release.pullquote) ? (
                <div className="w-full my-6 lg:hidden">
                  {carouselImages.length > 0 && (
                    <ImageCarousel images={carouselImages} />
                  )}
                  {release.pullquote && (
                    <blockquote className="mt-4 border-l-4 border-cyan-700 bg-gray-50 italic text-gray-700 px-5 py-4 text-base leading-relaxed">
                      <p>{(() => {
                        const text = release.pullquote.trim();
                        if (/^[""\u201C]/.test(text)) return text;
                        const match = text.match(/^(.*?)\s*(--\s*|—\s*|-\s+)(.+)$/s);
                        if (match) return <>{`\u201C${match[1].trimEnd()}\u201D `}<span className="not-italic">{match[2]}{match[3]}</span></>;
                        return `\u201C${text}\u201D`;
                      })()}</p>
                    </blockquote>
                  )}
                  <div className="flex items-center justify-end gap-1.5 mt-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Share</span>
                    <div className="w-px h-4 bg-gray-200" />
                    <ShareButtons
                      url={`https://www.newsworthy.ai${newsUrl(release)}`}
                      title={release.title}
                      abstract={release.abstract}
                      compact
                    />
                  </div>
                </div>
              ) : undefined
            }
          />

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
            {/* Author / Media Contact Card */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" itemScope itemType="https://schema.org/Person">
              <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">Media Contact</h3>
              </div>
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Contact avatar / Company logo */}
                  <div className="shrink-0">
                    {release.primaryContact?.avatar ? (
                      <img
                        src={release.primaryContact.avatar}
                        alt={release.primaryContact.name || ''}
                        className="w-16 h-16 rounded-full object-cover border-2 border-gray-100"
                        itemProp="image"
                      />
                    ) : company_logo_url ? (
                      <img
                        src={company_logo_url}
                        alt={release.company.companyName}
                        className="w-16 h-16 rounded-full object-contain bg-white border-2 border-gray-100 p-1"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 text-xl font-bold">
                        {release.company.companyName.charAt(0)}
                      </div>
                    )}
                  </div>
                  {/* Contact details */}
                  <div className="flex-1 min-w-0">
                    {release.primaryContact && (
                      <>
                        <h4 className="font-semibold text-lg text-gray-900 leading-tight" itemProp="name">{release.primaryContact.name}</h4>
                        {release.primaryContact.title && (
                          <p className="text-sm text-gray-500 mt-0.5" itemProp="jobTitle">{release.primaryContact.title}</p>
                        )}
                      </>
                    )}
                    <Link href={`/newsroom/${release.company.nrUri || release.company.uuid}`} className="text-sm font-medium text-sky-700 hover:underline mt-1 block" itemProp="worksFor">{release.company.companyName}</Link>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm">
                      {release.primaryContact?.phone && (
                        <Link href={`tel:${release.primaryContact.phone}`} className="text-sky-600 hover:underline" itemProp="telephone">
                          {release.primaryContact.phone}
                        </Link>
                      )}
                      {release.primaryContact?.email && contactEmailLink && (
                        <Link href={contactEmailLink} className="text-sky-600 hover:underline" itemProp="email">
                          Email Contact
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
                {/* Social links */}
                {(release.company.linkedinUrl || release.company.xUrl || release.company.facebookUrl || release.company.instagramUrl || release.company.youtubeUrl || release.company.website) && (
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                    {release.company.linkedinUrl && (
                      <Link href={release.company.linkedinUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="LinkedIn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </Link>
                    )}
                    {release.company.xUrl && (
                      <Link href={release.company.xUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="X">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </Link>
                    )}
                    {release.company.facebookUrl && (
                      <Link href={release.company.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Facebook">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </Link>
                    )}
                    {release.company.instagramUrl && (
                      <Link href={release.company.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="Instagram">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.88 0 1.441 1.441 0 012.88 0z"/></svg>
                      </Link>
                    )}
                    {release.company.youtubeUrl && (
                      <Link href={release.company.youtubeUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-gray-100 transition-colors" title="YouTube">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      </Link>
                    )}
                    {release.company.website && (
                      <>
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <Link href={release.company.website.startsWith('http') ? release.company.website : `https://${release.company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline flex items-center gap-1">
                          {new URL(release.company.website.startsWith('http') ? release.company.website : `https://${release.company.website}`).hostname} <ExternalLink size={12} />
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="my-6 py-4 border-t border-gray-200">
              <ShareButtons
                url={`https://www.newsworthy.ai${newsUrl(release)}`}
                title={release.title}
                abstract={release.abstract}
              />
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
                href={release.company?.website?.startsWith('http') ? release.company.website : `https://${release.company.website}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition-colors"
                target="_blank"
              >
                <span className="text-gray-500">Website</span>
                <span className="text-sky-600 flex items-center gap-1">{new URL(release.company.website.startsWith('http') ? release.company.website : `https://${release.company.website}`).hostname} <ExternalLink size={12} /></span>
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
