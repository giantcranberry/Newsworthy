import Link from 'next/link'
import { PortableText } from '@portabletext/react'

import { ContentSection } from '@/types/ContentSection'
import Image from 'next/image'
import { urlFor } from '@/sanity/sanity-utils'

type BandProps = {
  band: ContentSection
}

export function ImageContentBand({ band }: BandProps) {
  return (
    <div key={band._id} className="bg-teal-900 w-full py-28">
      <div className="mx-auto lg:max-w-7xl flex items-center justify-between">
        <div className="max-w-3xl">
          <h2 className="text-white text-4xl font-serif pb-7 font-semibold">
            {band.headline}
          </h2>
          <div className="prose leading-8 text-white text-2xl prose:font-sans font-light">
            <PortableText value={band.content} />
            {band.sectionCta.ctaUrl && (
              <Link
                href={band.sectionCta.ctaUrl}
                className="rounded bg-cyan-900 px-5 py-3 text-white hover:bg-cyan-800 font-bold"
              >
                {band.sectionCta.ctaLabel}
              </Link>
            )}
          </div>
        </div>
        <div className="text-center">
          {band.sectionImage && (
            <Image
              className="lg:h-[200px] lg:w-[200px] rounded-full object-cover"
              src={band.sectionImage && urlFor(band.sectionImage.asset)}
              alt={band.sectionImage && band.sectionImage.alt}
              width={250}
              height={250}
            />
          )}
        </div>
      </div>
    </div>
  )
}
