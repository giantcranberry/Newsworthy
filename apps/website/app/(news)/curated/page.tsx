import FeedCard from "@/components/feedCard";
import SearchCuratedComponent from "@/components/searchBarCurated";

import { getArticles, getArticlesCount } from "@/lib/db/Articles";
import { slugify } from "@/lib/article_utils";
import { Article } from "@/types/Articles";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export const revalidate = 10;

const ITEMS_PER_PAGE = 30;

type Props = {
  searchParams: Promise<{ page?: string }>;
};

export default async function Home({ searchParams }: Props) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page || "1", 10));

  const [articles, totalCount] = await Promise.all([
    getArticles(currentPage, ITEMS_PER_PAGE),
    getArticlesCount(),
  ]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (currentPage > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="border-b border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 py-8 lg:py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Curated News Stories
            </h1>
            <p className="mt-2 text-gray-500 text-base">
              Hand-picked stories from across the web, curated for relevance and quality.
            </p>
          </div>
          <div className="mt-6 max-w-xl">
            <SearchCuratedComponent />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl px-5 lg:px-8 mt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {articles.map((article) => (
            <FeedCard
              key={article.feed_item_id}
              link={`/curated/${slugify(
                article.headline
              )}/${article.published.substring(0, 4)}${
                article.feed_item_id
              }`}
              title={article.headline}
              abstract={article.summary}
              newsImage={article.enclosure}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination className="mt-12">
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious href={`/curated?page=${currentPage - 1}`} />
                </PaginationItem>
              )}

              {getPageNumbers().map((pageNum, index) =>
                pageNum === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      href={`/curated?page=${pageNum}`}
                      isActive={pageNum === currentPage}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext href={`/curated?page=${currentPage + 1}`} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
