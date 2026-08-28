import Image from 'next/image'
import Link from 'next/link'
import { getBannerAdBySlug } from '@/sanity/sanity-utils'
import type { BannerAd } from '@/types/BannerAd'

type PromoBar = {
  key: string
  href: string
  openInNewTab?: boolean
  logoUrl?: string
  logoAlt?: string
  logoWidth?: number
  logoHeight?: number
  eyebrow?: string
  subhead?: string
  headline: string
  body?: string
  imageUrl?: string
  imageAlt?: string
  ctaLabel: string
  ctaClassName: string
  barClassName: string
  barStyle?: React.CSSProperties
}

function CompactBar({ bar }: { bar: PromoBar }) {
  return (
    <Link
      href={bar.href}
      target={bar.openInNewTab ? '_blank' : undefined}
      rel={bar.openInNewTab ? 'noopener noreferrer' : undefined}
      className={`block h-full overflow-hidden rounded-xl text-white transition hover:opacity-95 ${bar.barClassName}`}
      style={bar.barStyle}
    >
      <div className="flex h-full items-center gap-4 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
        {bar.imageUrl && (
          <div className="relative h-24 w-20 shrink-0 sm:h-28 sm:w-24">
            <Image
              src={bar.imageUrl}
              alt={bar.imageAlt || bar.headline}
              fill
              className="object-contain object-center drop-shadow-md"
              sizes="96px"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:gap-2.5">
          {bar.logoUrl ? (
            <Image
              src={bar.logoUrl}
              alt={bar.logoAlt || ''}
              width={bar.logoWidth ?? 180}
              height={bar.logoHeight ?? 28}
              className="h-4 w-auto max-w-[160px] object-contain object-left sm:h-5 sm:max-w-[180px]"
            />
          ) : bar.eyebrow ? (
            <div>
              <p className="text-xl font-bold uppercase tracking-wider sm:text-2xl">
                {bar.eyebrow}
              </p>
              {bar.subhead && (
                <p className="text-[10px] font-medium tracking-wide text-white/80 sm:text-[11px]">
                  {bar.subhead}
                </p>
              )}
            </div>
          ) : null}

          <h3 className="font-serif text-sm font-semibold leading-snug text-balance sm:text-lg">
            {bar.headline}
          </h3>

          {bar.body && (
            <p className="hidden text-xs leading-relaxed text-white/85 lg:line-clamp-2 lg:block">
              {bar.body}
            </p>
          )}

          <span
            className={`mt-0.5 inline-flex w-fit items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold sm:text-sm ${bar.ctaClassName}`}
          >
            {bar.ctaLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

function fromBannerAd(
  ad: BannerAd,
  opts: {
    key: string
    barClassName: string
    barStyle?: React.CSSProperties
    ctaClassName: string
    preferCtaIndex?: number
    imageUrl?: string
    /** Text wordmark instead of logo image (SEO) */
    brandLabel?: string
    subhead?: string
  },
): PromoBar | null {
  const cta = ad.ctas?.[opts.preferCtaIndex ?? 0]
  if (!cta?.url || !cta.label) return null

  return {
    key: opts.key,
    href: cta.url,
    openInNewTab: cta.openInNewTab,
    logoUrl: opts.brandLabel ? undefined : ad.logo?.url,
    logoAlt: opts.brandLabel ? undefined : ad.logo?.alt,
    logoWidth: opts.brandLabel ? undefined : ad.logo?.width,
    logoHeight: opts.brandLabel ? undefined : ad.logo?.height,
    eyebrow: opts.brandLabel,
    subhead: opts.subhead,
    headline: (ad.headline || '').trim(),
    body: ad.plainText?.trim(),
    imageUrl: opts.imageUrl ?? ad.mobileImage?.url ?? ad.bannerImage?.url,
    imageAlt: ad.mobileImage?.alt || ad.bannerImage?.alt || ad.headline,
    ctaLabel: cta.label,
    ctaClassName: opts.ctaClassName,
    barClassName: opts.barClassName,
    barStyle: opts.barStyle,
  }
}

const brandEquityBar: PromoBar = {
  key: 'brand-equity',
  href: 'https://brandequitybook.com',
  openInNewTab: true,
  eyebrow: 'Brand Equity',
  subhead: 'The Book by the Founder of Online PR and News Marketing',
  headline: 'AI, News Marketing, and people: the new brand equity stack',
  body: 'A practical guide to building preference and findability in an AI-shaped market — so your brand is memorable, credible, and easy to retrieve.',
  imageUrl:
    'https://storydesk.us-southeast-1.linodeobjects.com/brandequity/images/1786813572719-ebook-cover-brand-equity.jpg',
  imageAlt: 'Brand Equity Book',
  ctaLabel: 'Get Your Free Copy',
  ctaClassName: 'bg-white text-[#003e79] hover:bg-slate-100',
  barClassName: '',
  barStyle: {
    backgroundImage: 'linear-gradient(90deg, #00205b, #003e79)',
  },
}

const newsCraftersBar: PromoBar = {
  key: 'newscrafters',
  href: 'https://newscrafters.com',
  openInNewTab: true,
  logoUrl: 'https://newscrafters.com/assets/logo-inverse.svg',
  logoAlt: 'NewsCrafters',
  logoWidth: 200,
  logoHeight: 30,
  headline: 'Weigh in on the news. Build lasting topic authority.',
  body: 'Curate stories from the newswires, add your expertise, and publish — free influence that earns Page 1 placements alongside major outlets. Generous Free Tier available.',
  imageUrl: '/promo/newscrafters-card.svg',
  imageAlt: 'NewsCrafters platform',
  ctaLabel: 'Build Your Brand',
  ctaClassName: 'bg-white text-slate-950 hover:bg-slate-100',
  barClassName: '',
  barStyle: {
    backgroundImage: 'linear-gradient(90deg, #0F172A, #155DFC)',
  },
}

export async function HomePromoBars() {
  const newsMarketing = await getBannerAdBySlug('news-marketing-book')

  const newsMarketingBar = newsMarketing
    ? fromBannerAd(newsMarketing, {
        key: 'news-marketing',
        barClassName: '',
        barStyle: {
          backgroundImage: 'linear-gradient(90deg, #530008, #9D1D2B)',
        },
        ctaClassName: 'bg-black text-white',
        imageUrl:
          newsMarketing.bannerImage?.url ?? newsMarketing.mobileImage?.url,
        brandLabel: 'News Marketing',
        subhead: 'The Book by the Founder of Online PR and News Marketing',
      })
    : null

  return (
    <section className="mx-auto grid w-full max-w-screen-xl grid-cols-1 gap-8 px-5 pt-5 md:grid-cols-2 xl:my-8 xl:max-w-screen-2xl">
      {newsMarketingBar && <CompactBar bar={newsMarketingBar} />}
      <CompactBar bar={brandEquityBar} />
    </section>
  )
}

/** Newsworthy + NewsCrafters — placed under the first Latest News lead row. */
export async function HomePlatformPromoBars({
  className = '',
}: {
  className?: string
}) {
  const seeYourNews = await getBannerAdBySlug('see-your-news-here')

  const seeYourNewsBar = seeYourNews
    ? fromBannerAd(seeYourNews, {
        key: 'see-your-news',
        barClassName: '',
        barStyle: {
          backgroundImage: 'linear-gradient(90deg, #1a667e, #11948b)',
        },
        ctaClassName: 'bg-white text-teal-950',
      })
    : null

  return (
    <div
      className={`grid grid-cols-1 gap-8 md:grid-cols-2 ${className}`.trim()}
    >
      {seeYourNewsBar && <CompactBar bar={seeYourNewsBar} />}
      <CompactBar bar={newsCraftersBar} />
    </div>
  )
}
