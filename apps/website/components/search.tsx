"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "./ui/button";
import { Search } from "lucide-react";
import GetTheBookBanner from "./get-the-book-banner";
import Link from "next/link";
import Image from "next/image";

export default function SearchBoxComponent() {
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(
      `/search?query=${encodeURIComponent(searchQuery)}&os_index=nw_releases`,
    );
  };

  return (
    <>
      <div className="bg-blue-600/5 px-5 lg:px-10">
        <div className="mx-auto max-w-screen-xl xl:max-w-screen-2xl flex flex-col-reverse px-5 md:flex-row justify-between items-end md:items-center lg:gap-10 pt-4 md:pt-0">
          <form
            onSubmit={handleSubmit}
            className="relative px-5 md:px-0 py-5 col-span-9 max-w-2xl lg:max-w-3xl w-full"
          >
            <Input
              type="text"
              placeholder="Search News"
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white text-gray-800 h-10 md:h-10 px-5 pr-10 rounded-full text-sm border border-slate-400"
              value={searchQuery}
            />
            <Button
              className="bg-transparent hover:bg-transparent text-gray-800 absolute right-5 top-5 md:top-5"
              aria-label="Search"
            >
              <Search size={15} />
            </Button>
          </form>
          <div className="col-span-3 px-7 md:px-0">
            <div className="flex gap-10">
              <Link href="https://newsramp.com/podcasts" target="_blank">
                <Image
                  src="https://cdn.newsramp.app/badges/news-featured-podcast.svg"
                  className="w-[130px] md:w-[165px] rounded"
                  alt="Listen on NewsRamp Podcasts"
                  width={165}
                  height={50}
                  sizes="100vw"
                  style={{ width: "100%", height: "auto" }}
                />
              </Link>
              <Link href="https://newscrafters.com/" target="_blank">
                <Image
                  src="https://cdn1.newsworthy.ai/images/icons/follow-newscrafters.svg"
                  className="w-[130px] md:w-[165px] rounded"
                  alt="Follow us on NewsCrafters"
                  width={165}
                  height={50}
                  sizes="100vw"
                  style={{ width: "100%", height: "auto" }}
                />
              </Link>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
