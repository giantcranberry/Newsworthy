import SafeImage from "@/components/safe-image";
import Link from "next/link";
import { Rss } from "lucide-react";
import { runSearch, SearchResultItem } from "@/lib/search";
import SeeYourNews from "@/components/see_your_news";

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{
    query?: string;
    from?: number;
    os_index?: string;
    osIndex?: string;
  }>;
}) {
  // Get the query parameter from the server context
  const resolvedSearchParams = await searchParams;
  const queryParam = resolvedSearchParams?.query || "";
  const queryFrom = Number(resolvedSearchParams?.from) || 0;
  const osIndex =
    resolvedSearchParams?.os_index || resolvedSearchParams?.osIndex || "";

  let searchResults: SearchResultItem[] = [];
  try {
    searchResults = await runSearch(queryParam, osIndex, queryFrom, 15);
  } catch (error) {
    console.error("Error fetching search results:", error);
  }

  const rssUrl = `/api/search/rss?query=${encodeURIComponent(queryParam)}${
    osIndex ? `&os_index=${encodeURIComponent(osIndex)}` : ""
  }`;

  return (
    <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl mt-5">
      <div className="grid grid-cols-1 lg:grid-flow-col gap-10">
        <div className="lg:col-span-2">
          <div>
            <h1 className="text-3xl">Search Results</h1>
            <p className="text-xl">
              The following are your search results for “{queryParam}”
            </p>
            <div className="mb-3 text-sm flex items-center gap-4">
              <span>
                {searchResults.length === 0
                  ? "No stories found"
                  : `Found ${searchResults.length} stories.`}
              </span>
              <a
                href={rssUrl}
                className="inline-flex items-center gap-1 text-orange-600 hover:text-orange-700"
                title="Subscribe to an RSS feed of this search"
              >
                <Rss size={14} />
                RSS feed for this search
              </a>
            </div>
          </div>
          <hr />
          {searchResults.map((result) => (
            <div
              key={result.id}
              className="group my-5 pb-2 w-full transition duration-300 grid lg:grid-cols-[235px_1fr] gap-5 border-b"
            >
              <div className="rounded overflow-hidden lg:h-[135px] w-full mb-7">
                <Link href={result.url}>
                  {result.image && (
                    <SafeImage
                      className="h-full transition duration-300 ease-in-out group-hover:scale-105"
                      src={result.image}
                      width={1200}
                      height={630}
                      alt={`banner image for: ${result.headline}`}
                    />
                  )}
                </Link>
              </div>
              <div className="flex flex-col gap-3 px-5">
                <Link
                  className="font-serif text-xl group-hover:text-sky-700"
                  href={result.url}
                >
                  {result.headline}
                </Link>
                <p className="prose">{result.abstract}</p>
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
