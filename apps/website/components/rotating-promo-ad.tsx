'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type PromoSlide = {
  key: string
  variant: 'banner' | 'card'
  imageSrc: string
  imageAlt: string
  imageClassName?: string
  /** Tailwind object-position for off-center source art */
  imagePosition?: string
  logoSrc?: string
  logoAlt?: string
  logoWidth?: number
  /** Text wordmark — preferred over logo image for SEO keywords */
  brandLabel?: string
  brandSubhead?: string
  title: string
  description?: string
  ctaLabel: string
  href: string
  openInNewTab?: boolean
  buttonClassName: string
  /** Banner variant only */
  barStyle?: React.CSSProperties
  /** Card variant only */
  cardClassName?: string
}

const slides: PromoSlide[] = [
  {
    key: 'news-marketing',
    variant: 'banner',
    imageSrc:
      'https://cdn.sanity.io/images/vt7ifwmf/production/d48c96976d3aa213bf6378cf36b106ddd75a3833-894x564.png',
    imageAlt: 'News Marketing Book',
    imagePosition: 'object-[42%_center]',
    brandLabel: 'News Marketing',
    brandSubhead: 'The Book - By David McInnis',
    title: 'The 28-Day Discipline That Keeps Brands Findable',
    ctaLabel: 'Get Your Free Copy',
    href: 'https://newsmarketingbook.com/nwai',
    openInNewTab: true,
    buttonClassName: 'bg-black text-white',
    barStyle: {
      backgroundImage: 'linear-gradient(160deg, #530008, #9D1D2B)',
    },
  },
  {
    key: 'brand-equity',
    variant: 'banner',
    imageSrc:
      'https://storydesk.us-southeast-1.linodeobjects.com/brandequity/images/1786813572719-ebook-cover-brand-equity.jpg',
    imageAlt: 'Brand Equity Book',
    imagePosition: 'object-center',
    brandLabel: 'Brand Equity',
    brandSubhead: 'The Book - By David McInnis',
    title: 'AI, News Marketing, and people: the new brand equity stack',
    ctaLabel: 'Get Your Free Copy',
    href: 'https://brandequitybook.com',
    openInNewTab: true,
    buttonClassName: 'bg-white text-[#003e79]',
    barStyle: {
      backgroundImage: 'linear-gradient(160deg, #00205b, #003e79)',
    },
  },
  {
    key: 'newscrafters',
    variant: 'card',
    imageSrc: '/promo/newscrafters-card.svg',
    imageAlt: 'NewsCrafters platform',
    imageClassName: 'object-contain bg-slate-100 p-2',
    logoSrc: 'https://newscrafters.com/assets/logo.svg',
    logoAlt: 'NewsCrafters',
    logoWidth: 180,
    title: 'Build Lasting Topic Authority',
    description:
      'Weigh in on the news and grow your brand. Generous Free Tier available.',
    ctaLabel: 'Build Your Brand',
    href: 'https://newscrafters.com',
    openInNewTab: true,
    cardClassName: 'border-indigo-200 from-slate-50 to-indigo-50',
    buttonClassName:
      'bg-slate-900 border-slate-900 text-white border-2',
  },
]

function pickRandomSlide() {
  return slides[Math.floor(Math.random() * slides.length)]
}

function CtaLabel({ slide }: { slide: PromoSlide }) {
  return (
    <span
      className={`mt-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${slide.buttonClassName}`}
    >
      {slide.ctaLabel}
      {slide.variant === 'card' && (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
          />
        </svg>
      )}
    </span>
  )
}

/** One random branded promo card per page load. */
export default function RotatingPromoAd() {
  const [slide, setSlide] = useState<PromoSlide | null>(null)

  useEffect(() => {
    setSlide(pickRandomSlide())
  }, [])

  if (!slide) {
    return (
      <div
        className="h-full min-h-[360px] w-full rounded-xl bg-gray-100"
        aria-hidden
      />
    )
  }

  const linkProps = {
    href: slide.href,
    target: slide.openInNewTab ? ('_blank' as const) : undefined,
    rel: slide.openInNewTab ? 'noopener noreferrer' : undefined,
  }

  if (slide.variant === 'card') {
    return (
      <Link
        {...linkProps}
        className={`relative flex h-full w-full flex-col items-center rounded-lg border bg-gradient-to-b p-4 text-center transition-shadow duration-300 hover:shadow-md ${slide.cardClassName}`}
      >
        <div className="mb-2 h-32 w-32 overflow-hidden rounded-full border-4 border-white/80 shadow-sm">
          <Image
            src={slide.imageSrc}
            width={128}
            height={128}
            className={`h-full w-full ${slide.imageClassName ?? 'object-cover'}`}
            alt={slide.imageAlt}
          />
        </div>

        {slide.brandLabel ? (
          <div className="mb-3">
            <p className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              {slide.brandLabel}
            </p>
            {slide.brandSubhead && (
              <p className="text-[11px] font-medium tracking-wide text-slate-600">
                {slide.brandSubhead}
              </p>
            )}
          </div>
        ) : slide.logoSrc ? (
          <Image
            src={slide.logoSrc}
            width={slide.logoWidth ?? 200}
            height={28}
            alt={slide.logoAlt || ''}
            className="mb-3 h-6 w-auto max-w-[220px] object-contain"
          />
        ) : null}

        <h2 className="mb-1 font-serif text-lg leading-snug">{slide.title}</h2>
        {slide.description && (
          <p className="mb-4 text-sm text-gray-500">{slide.description}</p>
        )}

        <CtaLabel slide={slide} />
      </Link>
    )
  }

  return (
    <Link
      {...linkProps}
      className="flex h-full w-full flex-col overflow-hidden rounded-xl text-white shadow-sm transition-shadow duration-300 hover:shadow-md"
      style={slide.barStyle}
    >
      <div className="relative mx-auto mt-6 mb-1 flex h-40 w-full max-w-[11rem] shrink-0 items-center justify-center px-2">
        <Image
          src={slide.imageSrc}
          alt={slide.imageAlt}
          fill
          className={`object-contain drop-shadow-lg ${slide.imagePosition ?? 'object-center'}`}
          sizes="176px"
        />
      </div>

      <div className="flex flex-1 flex-col items-center gap-2 px-5 pb-5 pt-5 text-center">
        {slide.brandLabel ? (
          <div>
            <p className="text-2xl font-bold uppercase tracking-wider text-white">
              {slide.brandLabel}
            </p>
            {slide.brandSubhead && (
              <p className="text-[11px] font-medium tracking-wide text-white/80">
                {slide.brandSubhead}
              </p>
            )}
          </div>
        ) : slide.logoSrc ? (
          <Image
            src={slide.logoSrc}
            alt={slide.logoAlt || ''}
            width={slide.logoWidth ?? 180}
            height={28}
            className="h-5 w-auto max-w-[200px] object-contain"
          />
        ) : null}

        <h2 className="font-serif text-lg font-semibold leading-snug text-balance">
          {slide.title}
        </h2>
        {slide.description && (
          <p className="line-clamp-3 text-sm leading-relaxed text-white/85">
            {slide.description}
          </p>
        )}

        <CtaLabel slide={slide} />
      </div>
    </Link>
  )
}
