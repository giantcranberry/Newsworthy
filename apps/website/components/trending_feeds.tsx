import Link from "next/link";
// import Image from 'next/image'
import { PartialReleaseType, PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import TrustedDialog from "./trusted";

type ReleaseProps = {
  release: PartialReleaseType;
  movement: number;
};

export function TrendingFeeds() {
  return (
    <div className="my-3 py-5 rounded-lg">
      <h1 className="text-lg uppercase font-extrabold m-0 text-cyan-800">
        Trending RSS Feeds
      </h1>
      <ul className="flex flex-wrap xl:flex-wrap gap-5 pt-4 group text-base">
        <li className="">
          <a
            href="https://app.newsworthy.ai/feeds/rss/latest.rss"
            className="font-bold hover:text-green-900 hover:bg-green-200/20 rounded p-2 text-center "
            target="_blank"
            rel="noopener dofollow"
          >
            Latest News
          </a>
        </li>
        <li className="">
          <a
            href="https://app.newsworthy.ai/feeds/beat/business/full/newsworthy/latest.rss"
            className="font-bold hover:text-green-900 hover:bg-green-200/20 rounded p-2 text-center"
            target="_blank"
            rel="noopener dofollow"
          >
            Business
          </a>
        </li>
        <li className="">
          <a
            href="https://app.newsworthy.ai/feeds/beat/health/full/newsworthy/latest.rss"
            className="font-bold hover:text-green-900 hover:bg-green-200/20 rounded p-2 text-center"
            target="_blank"
            rel="noopener dofollow"
          >
            Health & Fitness
          </a>
        </li>
        <li className="">
          <a
            href="https://app.newsworthy.ai/feeds/beat/technology-news/full/newsworthy/latest.rss"
            className="font-bold hover:text-green-900 hover:bg-green-200/20 rounded p-2 text-center"
            target="_blank"
            rel="noopener dofollow"
          >
            Technology
          </a>
        </li>
        <li className="">
          <a
            href="https://app.newsworthy.ai/feeds/beat/politics-public-policy/full/newsworthy/latest.rss"
            className="font-bold hover:text-green-900 hover:bg-green-200/20 rounded p-2 text-center"
            target="_blank"
            rel="noopener dofollow"
          >
            Politics
          </a>
        </li>
      </ul>
    </div>
  );
}
