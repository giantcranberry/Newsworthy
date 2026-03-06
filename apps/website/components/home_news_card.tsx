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

export function CardNews({ release }: ReleaseProps) {
  // Get the actual image dimensions from the release data or use defaults
  const originalWidth = release.banner?.width || 314;
  const originalHeight = release.banner?.height || 192;

  // Determine aspect ratio
  const aspectRatio = getImageAspectRatio(originalWidth, originalHeight);

  // Calculate dimensions - scale portrait images to match card height
  const dimensions =
    aspectRatio === "portrait"
      ? getScaledPortraitDimensions(originalWidth, originalHeight, 192)
      : { width: 314, height: 192 };

  return (
    <div
      key={release.id}
      className="flex flex-col bg-white group mb-5 pb-2 w-full transition duration-300 max-w-[328px] rounded"
    >
      <div className="lg:col-span-2 rounded overflow-hidden w-full mb-3">
        <div className="pt-5 pb-2 md:pt-0 rounded">
          <Link href={newsUrl(release)}>
            {release.banner?.cdnUrl && (
              <Image
                className={getImageClasses(
                  aspectRatio,
                  "w-full h-36 transition duration-300 ease-in-out group-hover:scale-105 rounded"
                )}
                src={release.banner.cdnUrl.replace(
                  "resize=width:675",
                  "resize=width:1200"
                )}
                width={dimensions.width}
                height={dimensions.height}
                alt={`banner image for: ${release.title}`}
              />
            )}
          </Link>
        </div>
      </div>

      <div className="lg:col-span-1 flex flex-col justify-between gap-3">
        {release.selfHost && <TrustedDialog />}
        <h2 className="font-serif text-xl group-hover:text-sky-700">
          <Link
            href={newsUrl(release)}
          >
            {release.title}
          </Link>
        </h2>
        <p className="text-sans line-clamp-3 text-base">{release.abstract}</p>
        <Link
          className="py-3 text-lg md:text-base group-hover:text-sky-700 group-hover:underline"
          href={newsUrl(release)}
        >
          Read more
        </Link>
      </div>
    </div>
  );
}
