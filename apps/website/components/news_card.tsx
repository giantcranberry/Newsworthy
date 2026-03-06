import Link from "next/link";

import Image from "next/image";
import { PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import { getImageAspectRatio, getImageClasses } from "@/lib/image-utils";
import TrustedDialog from "./trusted";

type ReleaseProps = {
  release: PressRelease;
};

export function HorizontalNews({ release }: ReleaseProps) {
  return (
    <div
      key={release.id}
      className="group my-5 pb-2 w-full transition duration-300 grid lg:grid-flow-col gap-5 border-b"
    >
      <div className="lg:col-span-2 rounded overflow-hidden w-full lg:w-[235px] lg:h-[135px] lg:mb-7">
        <Link href={newsUrl(release)}>
          {release.banner?.cdnUrl && (
            <Image
              className={getImageClasses(
                getImageAspectRatio(235, 135),
                "w-full h-full transition duration-300 ease-in-out group-hover:scale-105"
              )}
              src={release.banner.cdnUrl.replace(
                "resize=width:675",
                "resize=width:1200"
              )}
              width={235}
              height={135}
              alt={`banner image for: ${release.title}`}
            />
          )}
        </Link>
      </div>

      <div className="lg:col-span-1 flex flex-col lg:justify-between gap-3 lg:px-5">
        {release.selfHost && <TrustedDialog />}
        <h3 className="font-serif text-xl group-hover:text-sky-700">
          <Link
            href={newsUrl(release)}
          >
            {release.title}
          </Link>
        </h3>
        <p className="text-sans line-clamp-3 text-base">{release.abstract}</p>
        <Link
          className="pb-3 group-hover:text-sky-700 group-hover:underline"
          href={newsUrl(release)}
        >
          Read more
        </Link>
      </div>
    </div>
  );
}
