import Image from "next/image";
import Link from "next/link";
import { ElasticNwRelease } from "@/types/ElasticNwRelease";
import { baseUrl } from "@/lib/utils";
import SeeYourNews from "@/components/see_your_news";
import Influencer from "@/components/influencer_card";

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
  } catch (error) {
    console.error("Error fetching data:", error);
  }

  return (
    <div className="mx-auto lg:max-w-screen-lg xl:max-w-screen-xl mt-5">
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
                className="group my-5 pb-2 w-full transition duration-300 grid lg:grid-flow-col gap-5 border-b"
              >
                <div className="lg:col-span-2 rounded overflow-hidden lg:w-[235px] lg:h-[135px] w-full mb-7">
                  <Link href={release._source.url}>
                    {release._source.og_image && (
                      <Image
                        className="h-full transition duration-300 ease-in-out group-hover:scale-105"
                        src={release._source.og_image.replace(
                          "resize=width:675",
                          "resize=width:1200",
                        )}
                        width={1200}
                        height={1}
                        alt={`banner image for: ${release._source.headline}`}
                      />
                    )}
                  </Link>
                </div>
                <div className="lg:col-span-1 flex flex-col justify-between gap-3 px-5">
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
