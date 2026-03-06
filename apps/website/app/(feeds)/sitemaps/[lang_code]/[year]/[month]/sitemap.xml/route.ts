import { slugify } from "@/lib/article_utils";
import { getSitemapArticleUrls } from "@/lib/db/Articles";
import {
  getSitemapLanguageUrls,
  getSitemapUrls,
} from "@/lib/prisma/press_releases";
import {
  baseUrl,
  computeLastMod,
  formatDateForSitemap,
  newsUrl,
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
  let langCode: string;
  let year: number;
  let month: number;

  langCode = resolvedParams.lang_code;
  year = parseInt(resolvedParams.year);
  month = parseInt(resolvedParams.month);

  let news: SitemapEntry[] = [];
  let langString = "";

  if (langCode === "en") {
    langString = "";
    news = (await getSitemapUrls(year, month)) as unknown as SiteMapData[];
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

  const sitemap = news.map((entry) => ({
    loc: `https://newsworthy.ai${
      langCode === "en"
        ? sitemapUrl(entry as SiteMapData, langCode)
        : `/curated/${
            (entry as ArticleSiteMapDataExtended).slug
          }/${entry.released_at.getFullYear()}${entry.id}`
    }`,
    news: {
      title: entry.title,
      publicationName: "Newsworthy.ai",
      publicationLanguage: "en",
      date: formatDateForSitemap(entry.released_at, entry.timezone || "UTC"),
    },
    lastmod: formatDateForSitemap(entry.released_at, entry.timezone || "UTC"),
  }));

  return getServerSideSitemap(sitemap);
}
