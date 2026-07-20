import { db, sql } from "@/lib/db";
import { runQuery } from "@/lib/neon";
import { slugify } from "@/lib/article_utils";

// Postgres-backed site search. Two corpora:
//   - releases: the fraction DB (public press releases)
//   - curated:  the Neon DB (articles/feeditem/tldr, target newsworthy.ai)
//
// Both queries filter with websearch_to_tsquery, which natively supports
// quoted phrases ("harvest table"), OR, and -exclusions. Expression GIN
// indexes for both live in migration files (see repo /migrations notes); the
// index expression must stay textually in sync with the expressions below.

export interface SearchResultItem {
  id: string;
  source: "releases" | "curated";
  headline: string;
  abstract: string;
  url: string; // site-relative or absolute
  image: string;
  publishedAt: string; // ISO 8601
  // releases only
  prId?: number;
  prUuid?: string;
  location?: string;
}

function buildReleaseUrl(releaseAt: Date, id: number, slug: string): string {
  const y = releaseAt.getUTCFullYear();
  const m = String(releaseAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(releaseAt.getUTCDate()).padStart(2, "0");
  return `https://newsworthy.ai/news/${y}${m}${d}${id}/${slug}`;
}

export async function searchReleases(
  term: string,
  from: number = 0,
  limit: number = 15,
): Promise<SearchResultItem[]> {
  const matchClause = term.trim()
    ? sql`AND to_tsvector('english', coalesce(r.title, '') || ' ' || coalesce(r.abstract, '') || ' ' || coalesce(r.body, '')) @@ websearch_to_tsquery('english', ${term})`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      r.id,
      r.uuid,
      r.title,
      r.abstract,
      r.slug,
      r.location,
      r.release_at,
      b.url AS banner_url
    FROM releases r
    LEFT JOIN banners b ON b.id = r.banner_id
    WHERE r.status = 'sent'
      AND (r.is_deleted = false OR r.is_deleted IS NULL)
      AND r.release_at IS NOT NULL
      AND r.release_at <= now()
      ${matchClause}
    ORDER BY r.release_at DESC
    LIMIT ${limit} OFFSET ${from}
  `)) as unknown as Array<{
    id: number;
    uuid: string;
    title: string | null;
    abstract: string | null;
    slug: string | null;
    location: string | null;
    release_at: Date;
    banner_url: string | null;
  }>;

  return rows.map((r) => ({
    id: `release-${r.id}`,
    source: "releases",
    headline: r.title || "",
    abstract: r.abstract || "",
    url: buildReleaseUrl(new Date(r.release_at), r.id, r.slug || ""),
    image: r.banner_url
      ? r.banner_url.replace("/RESIZE/", "/resize=w:1200/")
      : "",
    publishedAt: new Date(r.release_at).toISOString(),
    prId: r.id,
    prUuid: r.uuid,
    location: r.location || "",
  }));
}

export async function searchCurated(
  term: string,
  from: number = 0,
  limit: number = 15,
): Promise<SearchResultItem[]> {
  if (!process.env.NEON_DIRECT_URL) {
    console.error("searchCurated: NEON_DIRECT_URL is not set");
    return [];
  }

  const match = term.trim()
    ? `AND to_tsvector('english', coalesce(a.article_json->>'headline', '') || ' ' || coalesce(a.article_json->>'content', '')) @@ websearch_to_tsquery('english', $1)`
    : "";
  const params: any[] = term.trim()
    ? [term, limit, from]
    : [limit, from];
  const limitParam = term.trim() ? "$2" : "$1";
  const offsetParam = term.trim() ? "$3" : "$2";

  const rows = await runQuery<{
    feed_item_id: number;
    headline: string | null;
    summary: string | null;
    enclosure: string | null;
    published: Date;
  }>(
    `
    SELECT
      a.feed_item_id,
      a.article_json->>'headline' AS headline,
      a.article_json->>'summary' AS summary,
      f.enclosure,
      f.published
    FROM articles a
    INNER JOIN feeditem f ON f.id = a.feed_item_id
    INNER JOIN tldr t ON t.feed_item_id = a.feed_item_id
    WHERE f.deleted_at IS NULL
      AND a.target = 'newsworthy.ai'
      AND f.published <= now()
      ${match}
    ORDER BY f.published DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
    `,
    params,
  );

  return rows.map((r) => {
    const publishedAt = new Date(r.published).toISOString();
    const headline = r.headline || "";
    return {
      id: `curated-${r.feed_item_id}`,
      source: "curated",
      headline,
      abstract: r.summary || "",
      url: `/curated/${slugify(headline)}/${publishedAt.substring(0, 4)}${r.feed_item_id}`,
      image: r.enclosure || "",
      publishedAt,
    };
  });
}

// os_index values are kept for URL compatibility with the old
// OpenSearch-backed search ("nw_releases", "newsramp_en").
export function resolveSearchSource(
  osIndex: string,
): "releases" | "curated" {
  return osIndex.toLowerCase().includes("newsramp") ? "curated" : "releases";
}

export async function runSearch(
  term: string,
  osIndex: string,
  from: number = 0,
  limit: number = 15,
): Promise<SearchResultItem[]> {
  const source = resolveSearchSource(osIndex);
  return source === "curated"
    ? searchCurated(term, from, limit)
    : searchReleases(term, from, limit);
}
