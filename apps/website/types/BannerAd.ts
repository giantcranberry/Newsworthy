import { PortableTextBlock } from 'sanity'

export type BannerAdLayout = 'split' | 'band' | 'image' | 'card'

export type BannerAdPlacement =
  | 'news-feed-band'
  | 'content-block'
  | 'navbar'
  | 'sidebar'
  | 'popup'

export type BannerAdCtaStyle = 'primary' | 'secondary' | 'outline' | 'link'

export type BannerAdImage = {
  url: string
  width?: number
  height?: number
  alt?: string
  credit?: string
}

export type BannerAdCta = {
  label: string
  url: string
  style?: BannerAdCtaStyle
  bgColor?: string
  textColor?: string
  openInNewTab?: boolean
  sponsored?: boolean
}

export type BannerAd = {
  _id: string
  _type: 'banner_ad'
  _createdAt?: string

  internalName: string
  slug: string
  enabled?: boolean
  placements?: BannerAdPlacement[]
  priority?: number
  startDate?: string
  endDate?: string
  disclosureLabel?: string
  layout: BannerAdLayout
  /** "Split" layout only: render single-column (text over image) at every viewport. */
  stacked?: boolean

  logo?: BannerAdImage
  eyebrow?: string
  headline?: string
  body?: PortableTextBlock[]
  /** Plain-text rendering of `body`, handy for places that can't render portable text. */
  plainText?: string
  bannerImage?: BannerAdImage
  mobileImage?: BannerAdImage
  imageSide?: 'left' | 'right'
  href?: string
  ctas?: BannerAdCta[]

  theme?: 'light' | 'dark'
  backgroundColor?: string
  useGradient?: boolean
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  gradientDirection?: string
  textColor?: string
  accentColor?: string
  customCss?: string
}

/** Shape of a `bannerAdEmbed` node inside portable text once the reference is expanded. */
export type BannerAdEmbed = {
  _type: 'bannerAdEmbed'
  _key?: string
  ad: BannerAd | null
}
