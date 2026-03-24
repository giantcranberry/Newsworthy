import Link from "next/link";

import Image from "next/image";
import { PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import { getImageAspectRatio, getImageClasses } from "@/lib/image-utils";
import TrustedDialog from "./trusted";

type ReleaseProps = {
  release: PressRelease;
};

function timeAgo(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function HorizontalNews({ release }: ReleaseProps) {
  return (
    <article className="group py-6 first:pt-0">
      <Link href={newsUrl(release)} className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4 sm:gap-6">
        {/* Text content */}
        <div className="flex flex-col justify-center gap-2.5 order-2 sm:order-1">
          <div className="flex items-center gap-3">
            {release.selfHost && <TrustedDialog />}
            {release.releasedAt && (
              <span className="text-xs text-gray-400">
                {timeAgo(release.releasedAt)}
              </span>
            )}
          </div>
          <h3 className="font-serif text-lg lg:text-xl font-semibold text-gray-900 leading-snug group-hover:text-cyan-700 transition-colors">
            {release.title}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {release.abstract}
          </p>
          <span className="text-xs font-medium text-gray-400 group-hover:text-cyan-600 transition-colors flex items-center gap-1 mt-0.5">
            Read more
            <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </div>

        {/* Image */}
        {release.banner?.cdnUrl && (
          <div className="order-1 sm:order-2 rounded-xl overflow-hidden bg-gray-100 aspect-[16/10] sm:aspect-[4/3]">
            <Image
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              src={release.banner.cdnUrl.replace(
                "resize=width:675",
                "resize=width:600"
              )}
              width={200}
              height={150}
              alt={`banner image for: ${release.title}`}
            />
          </div>
        )}
      </Link>
    </article>
  );
}
