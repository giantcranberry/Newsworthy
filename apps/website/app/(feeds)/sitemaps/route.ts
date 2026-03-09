import { getReleaseMonths } from "@/lib/prisma/press_releases";
import { baseUrl, computeLastMod, formatDateForSitemap } from "@/lib/utils";
import { getArticleMonths } from "@/lib/db/Articles";

export const dynamic = 'force-dynamic';

export const GET = async (): Promise<Response> => {
  const months = await getReleaseMonths();
  const articleMonths = await getArticleMonths();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Separate current month from older months for priority ordering
  const currentPrMonth = months.find(
    (m) => Number(m.year) === currentYear && Number(m.month) === currentMonth
  );
  const olderPrMonths = months.filter(
    (m) => !(Number(m.year) === currentYear && Number(m.month) === currentMonth)
  );

  const sitemaps: { loc: string; lastmod: string }[] = [];

  // 1. News sitemap first (most time-sensitive for Google News)
  sitemaps.push({
    loc: `${baseUrl}/news-sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  // 2. Current month press releases
  if (currentPrMonth) {
    sitemaps.push({
      loc: `${baseUrl}/sitemaps/en/${currentPrMonth.year}/${currentPrMonth.month}/sitemap.xml`,
      lastmod: formatDateForSitemap(now, "UTC"),
    });
  }

  // 3. Static site pages
  sitemaps.push({
    loc: `${baseUrl}/sitemap/site-pages/sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  // 4. Curated article months
  for (const month of articleMonths) {
    sitemaps.push({
      loc: `${baseUrl}/sitemaps/curated-en/${month.year}/${month.month}/sitemap.xml`,
      lastmod: computeLastMod(Number(month.year), Number(month.month)),
    });
  }

  // 5. Older press release months
  for (const month of olderPrMonths) {
    sitemaps.push({
      loc: `${baseUrl}/sitemaps/en/${month.year}/${month.month}/sitemap.xml`,
      lastmod: computeLastMod(Number(month.year), Number(month.month)),
    });
  }

  const entries = sitemaps
    .map(
      (s) => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
};
