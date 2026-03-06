"use client";

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

export function MobileNewsCard({ release }: ReleaseProps) {
  // Get the actual image dimensions from the release data or use defaults
  const originalWidth = release.banner?.width || 328;
  const originalHeight = release.banner?.height || 200;

  // Determine aspect ratio
  const aspectRatio = getImageAspectRatio(originalWidth, originalHeight);

  // Calculate dimensions - scale portrait images to match card height
  const dimensions =
    aspectRatio === "portrait"
      ? getScaledPortraitDimensions(originalWidth, originalHeight, 200)
      : { width: 328, height: 200 };

  return (
    <div key={release.id} className="px-5 pt-5">
      <div className="">
        <Link href={newsUrl(release)}>
          {release.banner?.cdnUrl && (
            <Image
              className={getImageClasses(
                aspectRatio,
                "w-full h-56 rounded border bg-slate-100"
              )}
              src={release.banner.cdnUrl.replace("RESIZE", "resize=w:500")}
              width={dimensions.width}
              height={dimensions.height}
              alt={`banner image for: ${release.title}`}
            />
          )}
        </Link>
      </div>

      <div className="lg:col-span-1 flex flex-col justify-between gap-3 pt-5">
        {release.selfHost && <TrustedDialog />}
        <h3 className="font-serif text-lg">
          <Link href={newsUrl(release)}>
            {release.title}
          </Link>
        </h3>
        <p className="font-sans line-clamp-3 text-base">{release.abstract}</p>
        <Link className="py-3 text-lg md:text-base" href={newsUrl(release)}>
          Read more
        </Link>
      </div>
    </div>
  );
}
