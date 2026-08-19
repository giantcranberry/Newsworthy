import { getReleaseMonths } from "@/lib/prisma/press_releases";
import { baseUrl, computeLastMod, formatDateForSitemap } from "@/lib/utils";
import { getArticleMonths } from "@/lib/db/Articles";

export const dynamic = "force-dynamic";

type MonthKey = `${number}-${number}`;

function monthKey(year: number, month: number): MonthKey {
  return `${year}-${month}`;
}

export const GET = async (): Promise<Response> => {
  const [prMonths, articleMonths] = await Promise.all([
    getReleaseMonths(),
    getArticleMonths(),
  ]);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Union of /news (en) and /curated months, keyed by year-month
  const byMonth = new Map<
    MonthKey,
    { year: number; month: number; hasPr: boolean; hasCurated: boolean }
  >();

  for (const m of prMonths) {
    const year = Number(m.year);
    const month = Number(m.month);
    const key = monthKey(year, month);
    const existing = byMonth.get(key);
    if (existing) {
      existing.hasPr = true;
    } else {
      byMonth.set(key, { year, month, hasPr: true, hasCurated: false });
    }
  }

  for (const m of articleMonths) {
    const year = Number(m.year);
    const month = Number(m.month);
    const key = monthKey(year, month);
    const existing = byMonth.get(key);
    if (existing) {
      existing.hasCurated = true;
    } else {
      byMonth.set(key, { year, month, hasPr: false, hasCurated: true });
    }
  }

  const monthsNewestFirst = [...byMonth.values()].sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });

  const sitemaps: { loc: string; lastmod: string }[] = [];

  // Rolling 48-hour Google News feed first
  sitemaps.push({
    loc: `${baseUrl}/news-sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  sitemaps.push({
    loc: `${baseUrl}/sitemap/site-pages/sitemap.xml`,
    lastmod: formatDateForSitemap(now, "UTC"),
  });

  // Monthly archives newest-first; /news then /curated within each month
  for (const { year, month, hasPr, hasCurated } of monthsNewestFirst) {
    const isCurrent = year === currentYear && month === currentMonth;
    const lastmod = isCurrent
      ? formatDateForSitemap(now, "UTC")
      : computeLastMod(year, month);

    if (hasPr) {
      sitemaps.push({
        loc: `${baseUrl}/sitemaps/en/${year}/${month}/sitemap.xml`,
        lastmod,
      });
    }
    if (hasCurated) {
      sitemaps.push({
        loc: `${baseUrl}/sitemaps/curated-en/${year}/${month}/sitemap.xml`,
        lastmod,
      });
    }
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
