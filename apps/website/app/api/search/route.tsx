import { NextResponse, NextRequest } from "next/server";

import { runSearch } from "@/lib/search";

// Postgres-backed search (replaces the former OpenSearch query). The response
// mimics the OpenSearch hit shape ({ _id, _source: {...} }) that the search
// page and ElasticNwRelease consumers already expect. The os_index parameter
// is retained for URL compatibility: values containing "newsramp" search the
// curated corpus; everything else searches releases.
export async function GET(request: NextRequest) {
  const searchTerm: string =
    request.nextUrl.searchParams.get("search_term") || "";
  const searchFrom: number =
    parseInt(request.nextUrl.searchParams.get("search_from") as string, 10) ||
    0;
  const osIndex: string = request.nextUrl.searchParams.get("os_index") || "";

  try {
    const results = await runSearch(searchTerm, osIndex, searchFrom, 15);

    const hits = results.map((r) => ({
      _index: r.source === "curated" ? "curated" : "releases",
      _id: r.id,
      _score: null,
      _source: {
        pr_id: r.prId ?? null,
        pr_uuid: r.prUuid ?? null,
        headline: r.headline,
        abstract: r.abstract,
        location: r.location ?? "",
        url: r.url,
        og_image: r.image,
        news_image: r.image,
        created_at: r.publishedAt,
        release_at: r.publishedAt,
      },
      sort: [new Date(r.publishedAt).getTime()],
    }));

    return NextResponse.json(hits);
  } catch (error) {
    console.error("Error fetching search results:", error);
    return NextResponse.error();
  }
}
