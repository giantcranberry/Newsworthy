import Link from "next/link";

import Image from "next/image";
import { PartialReleaseType, PressRelease } from "@/types/Release";
import { newsUrl } from "@/lib/utils";
import TrustedDialog from "./trusted";

type ReleaseProps = {
    release: PartialReleaseType;
    movement: number;
};

export function TrendingNews({ release, movement }: ReleaseProps) {
    return (
        <div key={release.slug} className="group w-full border-b last-of-type:border-0">
            <div className="flex flex-col justify-between gap-3 py-3">
                {release.selfHost && <TrustedDialog />}
                <Link className="font-serif text-lg group-hover:text-sky-700" href={newsUrl(release)}>
                    {release.title} {movement > 0 && <span className="text-green-600">▲</span>}
                </Link>
            </div>
        </div>
    );
}
