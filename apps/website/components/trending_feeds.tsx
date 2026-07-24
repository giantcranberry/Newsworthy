"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const feeds = [
  { label: "Latest News", href: "https://app.newsworthy.ai/feeds/rss/latest.rss" },
  { label: "Business", href: "https://app.newsworthy.ai/feeds/beat/business/full/newsworthy/latest.rss" },
  { label: "Health & Fitness", href: "https://app.newsworthy.ai/feeds/beat/health/full/newsworthy/latest.rss" },
  { label: "Technology", href: "https://app.newsworthy.ai/feeds/beat/technology-news/full/newsworthy/latest.rss" },
  { label: "Politics", href: "https://app.newsworthy.ai/feeds/beat/politics-public-policy/full/newsworthy/latest.rss" },
];

export function TrendingFeeds() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(
      `/search?query=${encodeURIComponent(searchQuery)}&os_index=nw_releases`,
    );
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
      {/* Trending feeds — left */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <svg className="h-3.5 w-3.5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.18 15.64a2.18 2.18 0 1 1 0 4.36 2.18 2.18 0 0 1 0-4.36M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1Z" />
          </svg>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Trending RSS Feeds
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {feeds.map((feed) => (
            <a
              key={feed.label}
              href={feed.href}
              target="_blank"
              rel="noopener dofollow"
              className="rounded-full border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-sm font-medium text-gray-700 transition-all hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900"
            >
              {feed.label}
            </a>
          ))}
        </div>
      </div>

      {/* Search + Badges — right, inline */}
      <div className="flex flex-wrap items-center gap-4 xl:flex-nowrap xl:shrink-0">
        <form
          onSubmit={handleSubmit}
          className="relative w-full sm:w-72 xl:w-96"
        >
          <Input
            type="text"
            placeholder="Search News"
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-white text-gray-800 h-10 px-5 pr-10 rounded-full text-sm border border-slate-300"
            value={searchQuery}
          />
          <Button
            className="bg-transparent hover:bg-transparent text-gray-800 absolute right-0 top-0"
            aria-label="Search"
          >
            <Search size={15} />
          </Button>
        </form>
        <Link href="https://newsramp.com/podcasts" target="_blank" className="hidden sm:block shrink-0">
          <Image
            src="https://cdn.newsramp.app/badges/news-featured-podcast.svg"
            className="h-10 w-auto rounded"
            alt="Listen on NewsRamp Podcasts"
            width={145}
            height={44}
          />
        </Link>
        <Link href="https://newscrafters.com/" target="_blank" className="hidden sm:block shrink-0">
          <Image
            src="https://cdn1.newsworthy.ai/images/icons/follow-newscrafters.svg"
            className="h-10 w-auto rounded"
            alt="Follow us on NewsCrafters"
            width={145}
            height={44}
          />
        </Link>
      </div>
    </div>
  );
}
