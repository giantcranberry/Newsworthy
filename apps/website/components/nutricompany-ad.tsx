import Image from 'next/image'
import Link from 'next/link'

/** Brand colors from nutricompany.com */
const NPI = {
  red: '#ae0c0d',
  redDark: '#790000',
  navy: '#0d475f',
  text: '#323336',
  muted: '#595a5e',
  wash: '#f1f1f3',
  accent: '#dbf2b7',
} as const

const HREF = 'https://nutricompany.com/'
const LOGO =
  'https://nutricompany.com/wp-content/uploads/2017/04/logo-2x.png'
const HERO =
  'https://nutricompany.com/wp-content/uploads/2017/04/1-HealthWellness.jpg'

/** Sponsored sidebar unit for the Health beat. */
export default function NutriCompanyAd() {
  return (
    <Link
      href={HREF}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="block overflow-hidden rounded-xl shadow-sm transition hover:shadow-md"
      style={{ backgroundColor: NPI.navy }}
    >
      <div className="relative h-36 w-full">
        <Image
          src={HERO}
          alt="Nutritional Products International — Health & Wellness"
          fill
          className="object-cover"
          sizes="340px"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to top, ${NPI.navy}, transparent 65%)`,
          }}
        />
        <span
          className="absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
          style={{ backgroundColor: NPI.red }}
        >
          Sponsored
        </span>
      </div>

      <div className="space-y-3 p-5 text-white">
        <div className="inline-flex rounded-md bg-white px-2.5 py-1.5">
          <Image
            src={LOGO}
            alt="Nutritional Products International"
            width={180}
            height={40}
            className="h-7 w-auto max-w-[180px] object-contain object-left"
          />
        </div>

        <div>
          <p
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: NPI.accent }}
          >
            Nutritional Products International
          </p>
          <h3 className="mt-1 font-serif text-xl font-semibold leading-snug text-white">
            The Path To Market
          </h3>
        </div>

        <p className="text-sm leading-relaxed text-white/80">
          Sales, marketing, and distribution solutions for CPG, health &amp;
          wellness, dietary supplement, nutrition, and beauty brands.
        </p>

        <span
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition"
          style={{ backgroundColor: NPI.red }}
        >
          Get Started
          <svg
            className="h-3.5 w-3.5"
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
        </span>
      </div>
    </Link>
  )
}

/** Horizontal listing-row unit — matches HorizontalNews feed layout. */
export function NutriCompanyListingAd() {
  return (
    <article className="group py-6">
      <Link
        href={HREF}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="grid grid-cols-1 overflow-hidden rounded-xl sm:grid-cols-[1fr_200px] gap-4 sm:gap-6 p-4 sm:p-5 transition hover:shadow-md"
        style={{ backgroundColor: NPI.navy }}
      >
        <div className="flex flex-col justify-center gap-2.5 order-2 sm:order-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: NPI.red }}
            >
              Sponsored
            </span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: NPI.accent }}
            >
              Nutritional Products International
            </span>
          </div>
          <h3 className="font-serif text-lg lg:text-xl font-semibold leading-snug text-white">
            The Path To Market
          </h3>
          <p className="text-sm line-clamp-2 leading-relaxed text-white/80">
            Sales, marketing, and distribution solutions for CPG, health &amp;
            wellness, dietary supplement, nutrition, and beauty brands.
          </p>
          <span
            className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
            style={{ backgroundColor: NPI.red }}
          >
            Get Started
            <svg
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
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
          </span>
        </div>

        <div className="order-1 sm:order-2 overflow-hidden rounded-lg aspect-[16/10] sm:aspect-[4/3]">
          <Image
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            src="/promo/nutricompany-beauty.jpg"
            width={200}
            height={150}
            alt="Nutritional Products International — Beauty"
          />
        </div>
      </Link>
    </article>
  )
}
