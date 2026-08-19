import { baseUrl, computeLastMod, formatDateForSitemap } from "@/lib/utils";
import { getArticleMonths } from "@/lib/db/Articles";

export const dynamic = "force-dynamic";

export const GET = async (): Promise<Response> => {
  const articleMonths = await getArticleMonths();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Prefer curated master URLs only — /sitemaps/en/… (press-release /news/…)
  // tracks are intentionally omitted to avoid duplicate canonicals.
  const currentCuratedMonth = articleMonths.find(
    (m) => Number(m.year) === currentYear && Number(m.month) === currentMonth,
  );
  const olderCuratedMonths = articleMonths.filter(
    (m) =>
      !(Number(m.year) === currentYear && Number(m.month) === currentMonth),
  );

  const sitemaps: { loc: string; lastmod: string }[] = [];

  // 1. News sitemap first (rolling 48-hour Google News feed)
  sitemaps.push({
    loc: `${baseUrl}/news-sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  // 2. Static site pages
  sitemaps.push({
    loc: `${baseUrl}/sitemap/site-pages/sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  // 3. Current month curated articles
  if (currentCuratedMonth) {
    sitemaps.push({
      loc: `${baseUrl}/sitemaps/curated-en/${currentCuratedMonth.year}/${currentCuratedMonth.month}/sitemap.xml`,
      lastmod: formatDateForSitemap(now, "UTC"),
    });
  }

  // 4. Older curated months
  for (const month of olderCuratedMonths) {
    sitemaps.push({
      loc: `${baseUrl}/sitemaps/curated-en/${month.year}/${month.month}/sitemap.xml`,
      lastmod: computeLastMod(Number(month.year), Number(month.month)),
    });
  }

  const entries = sitemaps
    .map(
      (s) => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`,
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
