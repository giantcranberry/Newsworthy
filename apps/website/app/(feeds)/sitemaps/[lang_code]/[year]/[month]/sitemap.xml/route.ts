import { slugify } from "@/lib/article_utils";
import {
  getCuratedPermalinkSet,
  getSitemapArticleUrls,
} from "@/lib/db/Articles";
import { getSitemapUrls } from "@/lib/prisma/press_releases";
import {
  formatDateForSitemap,
  sitemapUrl,
} from "@/lib/utils";
import { ArticleSiteMapData } from "@/types/Articles";
import { SiteMapData as OriginalSiteMapData } from "@/types/Release";
import { getServerSideSitemap } from "next-sitemap";

type Props = {
  params: Promise<{ lang_code: string; year: string; month: string }>;
};

type SiteMapData = OriginalSiteMapData & {
  slug?: string;
  release_datetime: string | Date;
  released_at: Date;
  timezone: string;
  prhashId?: string | null;
};

interface ArticleSiteMapDataExtended extends ArticleSiteMapData {
  slug: string;
  release_datetime: string;
  released_at: Date;
  timezone: string;
}

type SitemapEntry = SiteMapData | ArticleSiteMapDataExtended;

export async function GET(request: Request, { params }: Props) {
  const resolvedParams = await params;
  const langCode = resolvedParams.lang_code;
  const year = parseInt(resolvedParams.year);
  const month = parseInt(resolvedParams.month);

  let news: SitemapEntry[] = [];

  if (langCode === "en") {
    const rawNews = (await getSitemapUrls(
      year,
      month,
    )) as unknown as SiteMapData[];

    // Prefer curated master URL: drop /news/… entries that already have a curated twin
    const prHashes = rawNews
      .map((entry) => entry.prhashId)
      .filter((hash): hash is string => Boolean(hash));
    const curatedHashes = await getCuratedPermalinkSet(prHashes);

    news = rawNews
      .filter(
        (entry) => !entry.prhashId || !curatedHashes.has(entry.prhashId),
      )
      .map((entry) => ({
        ...entry,
        release_datetime:
          entry.release_datetime instanceof Date
            ? entry.release_datetime
            : new Date(entry.release_datetime as unknown as string),
        released_at:
          entry.released_at instanceof Date
            ? entry.released_at
            : new Date(entry.released_at as unknown as string),
      }));
  } else if (langCode === "curated-en") {
    const articleData = await getSitemapArticleUrls(year, month);
    news = articleData.map((article) => ({
      ...article,
      slug: slugify(article.title),
      release_datetime: article.released_at.toISOString(),
      released_at: article.released_at,
      timezone: "UTC",
    })) as ArticleSiteMapDataExtended[];
  }

  // Archive sitemaps: loc + lastmod only. Google News (<news:news>) belongs
  // exclusively in /news-sitemap.xml for the rolling 48-hour window.
  const sitemap = news.map((entry) => ({
    loc: `https://newsworthy.ai${
      langCode === "en"
        ? sitemapUrl(entry as SiteMapData, langCode)
        : `/curated/${
            (entry as ArticleSiteMapDataExtended).slug
          }/${entry.released_at.getFullYear()}${entry.id}`
    }`,
    lastmod: formatDateForSitemap(entry.released_at, entry.timezone || "UTC"),
  }));

  return getServerSideSitemap(sitemap);
}
