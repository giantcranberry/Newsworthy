import Image from "next/image";
import Link from "next/link";
import { db, eq, and, releases, translations, blockchain } from "@/lib/db";

import {
  convertRelatedLinksToList,
  formatTextWithPTags,
  getDateline,
  newsTranslatedUrl,
  newsUrl,
  replaceResizeWithWidth,
  separateNewsByLanguage,
} from "@/lib/utils";
import { QrCode, PressRelease } from "@/types/Release";

import { TranslatedNews } from "@/types/TranslatedNews";

import Influencer from "@/components/influencer_card";
import { notFound } from "next/navigation";
import { ExternalLink, Quote } from "lucide-react";
import { headers } from "next/headers";
import { PageStatsType } from "@/types/Stats";
import { postESGeneric } from "@/lib/elastic";
import { subscribeFormSchemaType } from "@/types/Forms";
import SubscribeForm from "@/components/forms/subscribe_form";
import PortraitVideoPlayer from "@/components/portrait_video_player";
import MediaPlacements from "@/components/media_placements";
import { InstagramEmbed } from "@/components/instagram-embed";

// Embed detection
function getEmbedInfo(url: string) {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  if (ytMatch) return { type: 'youtube' as const, embedUrl: `https://youtube.com/embed/${ytMatch[1]}` }
  const igMatch = url.match(/instagram\.com\/(reel|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) return { type: 'instagram' as const, url: `https://www.instagram.com/${igMatch[1]}/${igMatch[2]}/` }
  return null
}

type Props = {
  params: Promise<{ language_code: string; slug: string; id_string: string }>;
};

export const revalidate = 0;

const language_code = "es";

export default async function SpanishPR({ params }: Props) {
  const resolvedParams = await params;
  const pr_id = parseInt(resolvedParams.id_string.substring(8));

  const release = (await db.query.releases.findFirst({
    columns: {
      id: true,
      title: true,
      selfHost: true,
      slug: true,
      uuid: true,
      companyId: true,
      releasedAt: true,
      releaseAt: true,
      timezone: true,
      videoUrl: true,
      prhashId: true,
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
    },
    where: and(
      eq(releases.isDeleted, false),
      eq(releases.id, pr_id),
    ),
  })) as PressRelease | null;

  const pr: PressRelease | undefined = release ?? undefined;

  // https://www.npmjs.com/package/@sanity/image-url

  if (!pr) {
    return notFound();
  }

  const referenceNewsURL: string = newsUrl(pr);

  const translatedPRs = (await db.query.translations.findMany({
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
    where: eq(translations.prId, pr.id),
  })) as TranslatedNews[] | null;

  if (!translatedPRs) {
    return notFound();
  }

  const separatedNews = separateNewsByLanguage(translatedPRs);

  const es_pr: TranslatedNews | undefined = separatedNews["es"]?.[0];
  const fr_pr: TranslatedNews | undefined = separatedNews["fr"]?.[0];

  let fr_link: string = "";
  let es_link: string = "";

  if (fr_pr) {
    fr_link = newsTranslatedUrl(fr_pr);
  } else {
    fr_link = "";
  }

  if (es_pr) {
    es_link = newsTranslatedUrl(es_pr);
  } else {
    es_link = "";
  }

  const currentPr = es_pr;

  let company_logo_url: string = "";
  if (pr.company?.logoUrl) {
    company_logo_url = replaceResizeWithWidth(pr.company?.logoUrl, 400);
  }

  const dateline = getDateline(
    pr.releaseAt,
    pr.location ?? "Unknown Location",
    pr.timezone ?? "Unknown Timezone",
  );

  const qrcode = (await db.query.blockchain.findFirst({
    columns: {
      qrcode: true,
    },
    where: eq(blockchain.prid, pr_id),
  })) as QrCode | null;

  const qrcode_url = `https://cdn.newsworthy.ai/images/${qrcode?.qrcode}/${pr.uuid}_bco.png`;
  // TODO investigate how <Image component caches images. it may not work here. or we may not want it to...

  // TODO get you the url for the blockchain record page. waiting until we build that page out.

  // dateline is the date and location of the press release. it is a string.

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

  const stats: PageStatsType = {
    created_at: new Date(),
    request_ip: visitor_ip,
    user_agent: visitor_ua,
    referrer: referrer,
    user_platform: platform,
    pr_id: pr.id,
    pr_uuid: pr.uuid,
    pr_url: visitor_path,
    pr_company_id: pr.companyId,
    pr_user_id: pr.userId,
    pr_released_at: pr.releasedAt,
  };

  const company: subscribeFormSchemaType = {
    id: pr.company.uuid,
    company: pr.company.companyName,
  };

  postESGeneric(stats, "nw_pageviews");

  return (
    <div
      className="w-full md:max-w-4xl lg:max-w-7xl 2xl:max-w-screen-2xl lg:mx-auto grid grid-cols-1 lg:grid-flow-col gap-10 px-5 md:px-10 lg:px-0 mb-5 lg:my-10 xl:px-20"
      key={currentPr.prId}
    >
      <div className="col-span-2 flex flex-col items gap-5">
        <div className="flex justify-between lg:items-end pt-3">
          <div className="flex gap-5">
            {fr_link && (
              <Link className="text-sky-600 hover:underline" href={fr_link}>
                Lisez-le en Français (French)
              </Link>
            )}

            <Link
              className="text-sky-600 hover:underline"
              href={referenceNewsURL}
            >
              Léelo en Inglés (English)
            </Link>
          </div>
        </div>
        <h1 className="font-serif font-medium text-3xl lg:text-4xl">
          {currentPr.title}
        </h1>
        {pr.videoUrl && (() => {
          const embed = getEmbedInfo(pr.videoUrl)
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
        <p className="text-lg lg:text-xl font-light">{currentPr.abstract}</p>
        <div>
          <div className="flex gap-2">
            <p>{currentPr.dateline}</p>
          </div>
          <div className="lg:float-right pb-3 md:ml-5 mt-3 lg:mt-0 md:grid md:grid-cols-2 lg:block">
            <div>
              {pr.banner?.cdnUrl && (
                <Image
                  className="w-full md:w-[300px] lg:w-[320px] md:h-[180px] rounded mb-4"
                  src={pr.banner.cdnUrl.replace(
                    "resize=width:328",
                    "resize=width:1200",
                  )}
                  width={1200}
                  height={1}
                  alt={`banner image for: ${currentPr.title}`}
                />
              )}
            </div>
            <div>
              <Quote
                size={48}
                className="text-blue-200/40 absolute flex -mt-3 -ml-2"
              />
              <blockquote className="text-lg italic text-green-700 w-full md:w-[300px] lg:w-[250px] z-10 ml-3 relative">
                {(() => {
                  const text = currentPr.pullquote!.trim();
                  if (/^[""\u201C]/.test(text)) return text;
                  const match = text.match(/^(.*?)\s*(--\s*|—\s*|-\s+)(.+)$/s);
                  if (match) return <>{`\u201C${match[1].trimEnd()}\u201D `}<span className="not-italic">{match[2]}{match[3]}</span></>;
                  return `\u201C${text}\u201D`;
                })()}
              </blockquote>
            </div>
          </div>
          <div
            className="article max-w-none prose prose-p:text-base prose-p:text-black prose-li:pb-0 prose-li:marker:text-teal-600 prose-ol:list-decimal"
            dangerouslySetInnerHTML={{
              __html: formatTextWithPTags(currentPr.body!),
            }}
          />
          {pr.landingPage && (
            <Link
              href={pr.landingPage}
              className="text-sky-600 hover:underline"
            >
              Información Adicional
            </Link>
          )}

          <div className="my-5 flex flex-col gap-5">
            {currentPr.links && (
              <div>
                <h3 className="font-medium text-lg">
                  Ver También - Enlaces de Referencia y Relacionados
                </h3>
                <hr />
                <div
                  className="article "
                  dangerouslySetInnerHTML={{
                    __html: convertRelatedLinksToList(currentPr.links!),
                  }}
                />
              </div>
            )}
            <div>
              <p className="text-sm">
                <strong>Descargo de responsabilidad:</strong> Esta traducción ha
                sido generada automáticamente por Newsworthy.ai y plataformas de
                inteligencia artificial generativas de acceso público.
                Newsworthy no se hace responsable de la precisión de la
                traducción ni de cualquier daño que pueda surgir de su confianza
                en esta traducción. La versión oficial de este comunicado de
                prensa es{" "}
                <Link
                  className="text-sky-600 hover:underline"
                  href={referenceNewsURL}
                >
                  la versión en inglés.
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-2 md:col-span-2 lg:col-span-1">
        <div className="lg:max-w-[350px] w-full flex flex-col md:flex-row lg:flex-col items-start flex-wrap gap-5">
          <Link href={`/blockchain/txn-detail/${pr.uuid}`} target="_blank">
            <Image
              src={qrcode_url}
              alt="Código QR para Registro en la Cadena de Bloques Gráfico"
              className="w-[250px] aspect-auto"
              width={250}
              height={1}
            />
          </Link>
          <div>
            <h3 className="text-xl pb-2">Noticias de</h3>
            {pr.company?.logoUrl && (
              <Image
                className="mb-3 rounded"
                src={company_logo_url}
                width={150}
                height={1}
                alt={`company logo for: ${pr.company.companyName}`}
              />
            )}
            <h4 className="font-lg">{pr.company?.companyName}</h4>
            <div className="flex gap-10">
              {pr.company?.phone && (
                <Link
                  href={pr.company?.phone}
                  className="text-sky-600 hover:underline"
                >
                  Tel. {pr.company?.phone}
                </Link>
              )}
              {pr.company?.website && (
                <Link
                  href={pr.company?.website}
                  className="text-sky-600 hover:underline flex gap-1"
                >
                  Sitio web <ExternalLink size={20} />
                </Link>
              )}
            </div>
            {pr.company.nrUri && (
              <div className="mt-3">
                <Link
                  href={`https://newsworthy.ai/newsroom/${pr.company.nrUri}`}
                  className="text-sky-600 hover:underline flex gap-1 items-center"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Sala de Prensa Online <ExternalLink size={16} />
                </Link>
              </div>
            )}
          </div>
          <hr />
          {pr.prhashId && (
            <PortraitVideoPlayer prhashId={pr.prhashId} />
          )}
          <SubscribeForm company={company} />
          {pr.prhashId && (
            <MediaPlacements prhashId={pr.prhashId} />
          )}
        </div>
      </div>
    </div>
  );
}
