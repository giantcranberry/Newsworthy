import { getReleaseMonths } from "@/lib/prisma/press_releases";
import { baseUrl, computeLastMod, formatDateForSitemap } from "@/lib/utils";
import { getServerSideSitemap } from "next-sitemap";
import { getArticleMonths } from "@/lib/db/Articles";

interface SitemapEntry {
  loc: string;
  lastmod: string;
}

export const GET = async (request: Request): Promise<Response> => {
  const months = await getReleaseMonths();
  const articleMonths = await getArticleMonths();
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const sitemap: SitemapEntry[] = [
    {
      loc: `${baseUrl}/sitemap/site-pages/sitemap.xml`,
      lastmod: formatDateForSitemap(),
    },
    {
      loc: `${baseUrl}/sitemap/blog-posts/sitemap.xml`,
      lastmod: new Date().toISOString(),
    },
    ...articleMonths.map((month) => ({
      loc: `${baseUrl}/sitemaps/curated-en/${month.year}/${month.month}/sitemap.xml`,
      lastmod: computeLastMod(Number(month.year), Number(month.month)),
    })),
    ...months.map((month) => ({
      loc: `${baseUrl}/sitemaps/en/${month.year}/${month.month}/sitemap.xml`,
      lastmod: computeLastMod(Number(month.year), Number(month.month)),
    })),
  ];

  return getServerSideSitemap(sitemap);
};
