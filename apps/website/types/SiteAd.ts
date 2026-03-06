export type SiteAd = {
  _id: string
  _createdAt: Date
  title: string
  subtitle: string
  slug: {
    current: string
  }
  ad_image: {
    asset: {
      url: string
    }
    alt: string
    credit: string
  }
  ad_cta: {
    cta_text: string
    cta_link: string
  }
  ad_cta_2: {
    cta_text: string
    cta_link: string
  }
  textContent: string
}
