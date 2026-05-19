import Image from "next/image"
import { getImageDimensions } from '@sanity/asset-utils'
import { urlFor } from "@/sanity/sanity-utils"
import BannerAdBlock from "@/components/banner-ad/banner-ad-block"
import type { BannerAd } from "@/types/BannerAd"

export const PortableTextImageComponent = ({ value }: { value: any }) => {
    const imageUrl = urlFor(value) // Assuming urlFor
    const { width, height } = getImageDimensions(value)

    return (
      <div className="flex justify-center">
        <Image
          src={imageUrl}
          alt={value.alt || ' '}
          loading="lazy"
          width={width}
          height={1}
          style={{
            aspectRatio: width / height,
          }}
          className="rounded-lg"
        />
      </div>
    )
  }

// Renders a `bannerAdEmbed` node inside portable text. The reference is expected
// to be expanded server-side (see `portableTextWithAds` in sanity-utils).
export const BannerAdEmbedComponent = ({ value }: { value: { ad?: BannerAd | null } }) => {
  if (!value?.ad) return null
  return (
    <div className="not-prose my-8">
      <BannerAdBlock ad={value.ad} />
    </div>
  )
}

// Shared component map for <PortableText components={portableTextComponents} />
export const portableTextComponents = {
  types: {
    image: PortableTextImageComponent,
    bannerAdEmbed: BannerAdEmbedComponent,
  },
}
