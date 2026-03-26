import Link from "next/link";
import Image from "next/image";
import { PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import {
  getImageAspectRatio,
  getImageClasses,
  getScaledPortraitDimensions,
} from "@/lib/image-utils";
import TrustedDialog from "./trusted";

type ReleaseProps = {
  release: PressRelease;
};

function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "Just now";
}

export function CardNews({ release }: ReleaseProps) {
  const originalWidth = release.banner?.width || 314;
  const originalHeight = release.banner?.height || 192;
  const aspectRatio = getImageAspectRatio(originalWidth, originalHeight);
  const dimensions =
    aspectRatio === "portrait"
      ? getScaledPortraitDimensions(originalWidth, originalHeight, 192)
      : { width: 314, height: 192 };

  const firstCategory = release.releaseCategories?.[0]?.category;

  return (
    <Link
      href={newsUrl(release)}
      key={release.id}
      className="flex flex-col bg-white group w-full max-w-[328px] rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300"
    >
      {/* Image */}
      <div className="overflow-hidden h-48">
        {release.banner?.cdnUrl ? (
          <Image
            className="w-full h-full object-cover object-top transition duration-300 ease-in-out group-hover:scale-105"
            src={release.banner.cdnUrl.replace(
              "resize=width:675",
              "resize=width:1200"
            )}
            width={314}
            height={192}
            alt={release.title || "Press release image"}
          />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 p-4 flex-1">
        {/* Category */}
        <div className="flex items-center gap-2">
          {release.selfHost && <TrustedDialog />}
          {firstCategory && (
            <span className="text-xs font-medium text-sky-700">
              {firstCategory.name}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="font-serif text-lg leading-snug line-clamp-3 group-hover:text-sky-700 transition-colors">
          {release.title}
        </h2>

        {/* Abstract */}
        <p className="text-sm text-gray-500 line-clamp-2">{release.abstract}</p>

        {/* Meta */}
        <div className="flex items-center gap-1.5 mt-auto pt-2 text-xs text-gray-400">
          <span>{release.company?.companyName}</span>
          <span>&middot;</span>
          {release.releasedAt && <time>{timeAgo(release.releasedAt)}</time>}
        </div>
      </div>
    </Link>
  );
}
