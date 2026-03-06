import Link from 'next/link'

import Image from 'next/image'
import { PressRelease } from '@/types/Release'
import { newsUrl } from '@/lib/utils'
import TrustedDialog from './trusted'

type ReleaseProps = {
  release: PressRelease
}

export function AgencyNewsCards({ release }: ReleaseProps) {
  return (
    <div
      key={release.id}
      className="flex flex-col bg-white group mb-5 pb-2 w-full transition duration-300"
    >
      <div className="lg:col-span-2 rounded overflow-hidden w-full mb-3">
        <Link href={newsUrl(release)}>
          {release.banner?.cdnUrl && (
            <Image
              className="hover:translate-12 w-full transition duration-500 ease-in-out group-hover:scale-105 lg:w-full"
              src={release.banner.cdnUrl.replace(
                'resize=width:675',
                'resize=width:1200'
              )}
              width={1200}
              height={1}
              alt={`banner image for: ${release.title}`}
            />
          )}
        </Link>
      </div>

      <div className="lg:col-span-1 flex flex-col justify-between gap-3">
        {release.selfHost && <TrustedDialog />}
        <Link
          className="font-serif text-xl group-hover:text-sky-700"
          href={newsUrl(release)}
        >
          {release.title}
        </Link>
        <p className="text-lg text-sans line-clamp-3">{release.abstract}</p>
        <Link
          className="pb-3 group-hover:text-sky-700 group-hover:underline"
          href={newsUrl(release)}
        >
          Read more
        </Link>
      </div>
    </div>
  )
}
