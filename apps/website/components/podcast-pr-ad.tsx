import Image from 'next/image'
import Link from 'next/link'

export default function PodcastPrAd() {
  return (
    <Link
      href="https://podcastpr.news"
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full w-full flex-col items-center rounded-lg border border-rose-200 bg-gradient-to-b from-rose-50 to-red-50 p-4 text-center transition-shadow duration-300 hover:shadow-md hover:border-rose-300"
    >
      <div className="mb-2 h-32 w-32 overflow-hidden rounded-full border-4 border-white/80 bg-white shadow-sm">
        <Image
          src="https://storydesk.us-southeast-1.linodeobjects.com/podcastpr/siteconfig/1783613742368-apple-touch-icon.png"
          width={128}
          height={128}
          className="h-full w-full object-cover"
          alt="Podcast PR"
        />
      </div>

      <Image
        src="https://storydesk.us-southeast-1.linodeobjects.com/podcastpr/siteconfig/1783613735646-logo.svg"
        width={200}
        height={32}
        alt="Podcast PR"
        className="mb-3 h-7 w-auto max-w-[220px] object-contain"
      />

      <h2 className="mb-1 font-serif text-lg leading-snug">
        Turn Every Episode Into Press Coverage
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Connect your show&apos;s RSS feed and turn new episodes into newsroom-ready
        releases.
      </p>

      <span className="mt-auto inline-flex items-center gap-2 rounded-lg border-2 border-[#a6122b] bg-[#a6122b] px-4 py-2 text-sm font-semibold text-white">
        Get Podcast PR
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
      </span>
    </Link>
  )
}
