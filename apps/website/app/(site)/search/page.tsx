import SafeImage from "@/components/safe-image";
import Link from "next/link";
import { ElasticNwRelease } from "@/types/ElasticNwRelease";
import { baseUrl } from "@/lib/utils";
import { db, eq, inArray, releases, banners } from "@/lib/db";
import SeeYourNews from "@/components/see_your_news";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{
    query?: string;
    from?: number;
    osIndex?: string;
  }>;
}) {
  // Get the query parameter from the server context
  const resolvedSearchParams = await searchParams;
  const queryParam = resolvedSearchParams?.query || "";
  const queryFrom = resolvedSearchParams?.from || 0;
  const osIndex = resolvedSearchParams?.osIndex || "";

  let searchResults: ElasticNwRelease[] = [];
  try {
    const response = await fetch(
      `${baseUrl}/api/search?search_term=${encodeURIComponent(
        queryParam,
      )}&search_from=${queryFrom}&os_index=${osIndex}`,
      { cache: "no-store" },
    );

    searchResults = await response.json();

    // Replace stale og_image URLs with banner URLs from database
    const prIds = searchResults.map((r) => r._source.pr_id).filter(Boolean);
    if (prIds.length > 0) {
      const bannerRows = await db
        .select({
          releaseId: releases.id,
          bannerUrl: banners.url,
        })
        .from(releases)
        .innerJoin(banners, eq(releases.bannerId, banners.id))
        .where(inArray(releases.id, prIds));

      const bannerMap = new Map(
        bannerRows.map((row) => [row.releaseId, row.bannerUrl])
      );

      for (const result of searchResults) {
        const bannerUrl = bannerMap.get(result._source.pr_id);
        result._source.og_image = bannerUrl || "";
      }
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  return (
    <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-5">
      <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
        <div className="lg:col-span-2">
          <div>
            <h1 className="text-3xl">Search Results</h1>
            <p className="text-xl">
              The following are your search results for “{queryParam}”
            </p>
            <div className="mb-3 text-sm">
              {searchResults.length === 0
                ? "No stories found"
                : `Found ${searchResults.length} stories.`}
            </div>
          </div>
          <hr />
          {searchResults &&
            searchResults.map((release) => (
              <div
                key={release._source.pr_id}
                className="group my-5 pb-2 w-full transition duration-300 grid lg:grid-cols-[235px_1fr] gap-5 border-b"
              >
                <div className="rounded overflow-hidden lg:h-[135px] w-full mb-7">
                  <Link href={release._source.url}>
                    {release._source.og_image && (
                      <SafeImage
                        className="h-full transition duration-300 ease-in-out group-hover:scale-105"
                        src={release._source.og_image}
                        width={1200}
                        height={630}
                        alt={`banner image for: ${release._source.headline}`}
                      />
                    )}
                  </Link>
                </div>
                <div className="flex flex-col gap-3 px-5">
                  <Link
                    className="font-serif text-xl group-hover:text-sky-700"
                    href={release._source.url}
                  >
                    {release._source.headline}
                  </Link>
                  <p className="prose">{release._source.abstract}</p>
                </div>
              </div>
            ))}
        </div>
        <div className="md:col-span-2 lg:col-span-1 w-full lg:max-w-[350px] flex flex-col md:flex-row lg:flex-col gap-5 px-5 lg:px-0">
          <SeeYourNews />
        </div>
      </div>
    </div>
  );
}
