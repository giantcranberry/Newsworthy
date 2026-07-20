import { NextRequest } from "next/server";

import { runSearch, resolveSearchSource } from "@/lib/search";

const SITE_URL = "https://newsworthy.ai";
const MAX_ITEMS = 50;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `${SITE_URL}${url}`;
}

// Live RSS 2.0 feed of search results. Subscribers get new matching stories
// as they publish — the query re-runs on each fetch, and the embargo filter
// (release_at <= now()) applies just like on-site search.
//
//   /api/search/rss?query=harvest+table&os_index=nw_releases
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("query") || params.get("search_term") || "";
  const osIndex = params.get("os_index") || "";

  const results = await runSearch(query, osIndex, 0, MAX_ITEMS);

  const source = resolveSearchSource(osIndex);
  const feedTitle = query.trim()
    ? `Newsworthy.ai ${source === "curated" ? "curated news" : "news"} search: ${query}`
    : `Newsworthy.ai ${source === "curated" ? "curated news" : "news"}`;
  const selfUrl = `${SITE_URL}/api/search/rss?query=${encodeURIComponent(query)}${osIndex ? `&os_index=${encodeURIComponent(osIndex)}` : ""}`;
  const htmlUrl = `${SITE_URL}/search?query=${encodeURIComponent(query)}${osIndex ? `&os_index=${encodeURIComponent(osIndex)}` : ""}`;

  const items = results
    .map((r) => {
      const link = absoluteUrl(r.url);
      return `    <item>
      <title>${xmlEscape(r.headline)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <description>${xmlEscape(r.abstract)}</description>
      <pubDate>${new Date(r.publishedAt).toUTCString()}</pubDate>${
        r.image
          ? `\n      <enclosure url="${xmlEscape(absoluteUrl(r.image))}" type="image/jpeg" length="0" />`
          : ""
      }
    </item>`;
    })
    .join("\n");

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(feedTitle)}</title>
    <link>${xmlEscape(htmlUrl)}</link>
    <atom:link href="${xmlEscape(selfUrl)}" rel="self" type="application/rss+xml" />
    <description>${xmlEscape(`Latest stories matching "${query}" on Newsworthy.ai`)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
    },
  });
}
