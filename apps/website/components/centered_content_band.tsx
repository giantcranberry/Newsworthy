import Link from 'next/link'
import { PortableText } from '@portabletext/react'

import { ContentSection } from '@/types/ContentSection'
import { portableTextComponents } from '@/components/portable_text_component'

type BandProps = {
  band: ContentSection
}

export function CenteredContentBand({ band }: BandProps) {
  return (
    <div key={band._id} className="bg-teal-900 w-full py-10 lg:max-w-full">
      <div className="mx-auto flex flex-col items-center justify-center max-w-3xl">
        <div>
          <h2 className="text-white text-3xl font-serif pb-5 font-semibold">
            {band.headline}
          </h2>
        </div>
        <div className="prose leading-8 text-white text-lg px-10 prose:font-sans font-light mb-7 text-center">
          <PortableText value={band.content} components={portableTextComponents} />
        </div>
        <div>
          {band.sectionCta.ctaUrl && (
            <Link
              href={band.sectionCta.ctaUrl}
              className="rounded bg-teal-600 px-5 py-3 text-white hover:bg-teal-500 font-bold"
            >
              {band.sectionCta.ctaLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
