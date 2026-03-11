import { getSiteAdBySlug } from "@/sanity/sanity-utils";
import Link from "next/link";

function DesktopMockup() {
  return (
    <div className="w-[400px] rounded-lg bg-white shadow-2xl shadow-black/20 text-left overflow-hidden">
      {/* Browser bar */}
      <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <div className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
        <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
        <div className="ml-2 h-3 flex-1 rounded-full bg-gray-200" />
      </div>
      <div className="p-5 space-y-3">
        <p className="text-sm font-serif font-semibold leading-tight text-gray-800">
          Your Company Announces Groundbreaking New Product Launch
        </p>
        <p className="text-[10px] leading-snug text-gray-400">
          A brief summary of your press release that captures the key message and draws readers in.
        </p>
        <div className="flex gap-1.5">
          <div className="h-5 px-2.5 rounded-full bg-sky-50 flex items-center justify-center">
            <span className="text-[8px] font-semibold text-sky-600">Technology</span>
          </div>
          <div className="h-5 px-2.5 rounded-full bg-sky-50 flex items-center justify-center">
            <span className="text-[8px] font-semibold text-sky-600">Business</span>
          </div>
        </div>
        {/* TLDR */}
        <div className="rounded bg-yellow-700/5 p-3 space-y-1.5">
          <span className="text-[9px] font-bold text-gray-700">Key Takeaways (TLDR)</span>
          <ul className="pl-3 space-y-0.5 text-[8px] text-gray-400 list-disc list-inside">
            <li>Key insight about company impact</li>
            <li>Important metric or achievement</li>
            <li>Strategic outlook and next steps</li>
          </ul>
        </div>
        {/* Body with floated image + pullquote */}
        <div>
          <div className="float-right ml-3 mb-2 w-[140px]">
            <div className="w-full h-[80px] rounded bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
              </svg>
            </div>
            <div className="mt-2 border-l-2 border-cyan-500 pl-2 py-1">
              <p className="text-[8px] italic text-gray-400 leading-snug">
                &ldquo;This changes everything for our industry&rdquo; — CEO
              </p>
            </div>
          </div>
          <p className="text-[9px] leading-relaxed text-gray-300">
            NEW YORK, NY (Newsworthy.ai) — Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileMockup() {
  return (
    <div className="w-[170px] rounded-2xl bg-gray-900 p-2 shadow-2xl shadow-black/20 text-left">
      {/* Phone frame */}
      <div className="rounded-xl bg-white overflow-hidden">
        {/* Status bar with notch */}
        <div className="flex items-center justify-center bg-white pt-1.5 pb-1 relative">
          <div className="h-2 w-12 rounded-full bg-gray-900" />
        </div>
        <div className="px-3 pb-3 pt-1.5 space-y-2">
          {/* Headline */}
          <p className="text-[9px] font-serif font-semibold leading-tight text-gray-800">
            Your Company Announces New Product Launch
          </p>
          {/* Abstract */}
          <p className="text-[7px] leading-snug text-gray-400">
            A brief summary of your press release.
          </p>
          {/* Category pills */}
          <div className="flex gap-1">
            <div className="h-3.5 px-1.5 rounded-full bg-sky-50 flex items-center justify-center">
              <span className="text-[5px] font-semibold text-sky-600">Technology</span>
            </div>
            <div className="h-3.5 px-1.5 rounded-full bg-sky-50 flex items-center justify-center">
              <span className="text-[5px] font-semibold text-sky-600">Business</span>
            </div>
          </div>
          {/* TLDR */}
          <div className="rounded bg-yellow-700/5 p-2 space-y-1">
            <span className="text-[6px] font-bold text-gray-700">Key Takeaways (TLDR)</span>
            <ul className="pl-2 space-y-0.5 text-[5px] text-gray-400 list-disc list-inside">
              <li>Key company insight</li>
              <li>Important achievement</li>
            </ul>
          </div>
          {/* Full-width image (mobile layout) */}
          <div className="w-full h-[45px] rounded bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          {/* Pullquote */}
          <div className="border-l-2 border-cyan-500 pl-1.5 py-0.5">
            <p className="text-[6px] italic text-gray-400 leading-snug">
              &ldquo;This changes everything&rdquo; — CEO
            </p>
          </div>
          {/* Body */}
          <p className="text-[6px] leading-relaxed text-gray-300">
            NEW YORK, NY — Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt.
          </p>
        </div>
      </div>
    </div>
  );
}


export default async function SeeYourNews() {
  const see_news_ad = await getSiteAdBySlug("see-your-news-here");
  return (
    <div className="relative rounded-xl bg-gradient-to-br from-cyan-800 via-cyan-700 to-teal-600 text-white overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 p-6 md:p-10">
        <div className="flex flex-col gap-4 text-center md:text-left justify-center">
          {see_news_ad.subtitle && (
            <span className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
              {see_news_ad.subtitle}
            </span>
          )}
          <h3 className="font-serif text-3xl md:text-4xl font-semibold leading-tight">
            {see_news_ad.title}
          </h3>
          <p className="text-base md:text-lg text-cyan-100">
            {see_news_ad.textContent}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-2 mx-auto md:mx-0">
            <Link
              href={see_news_ad.ad_cta.cta_link}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-cyan-800 transition-all hover:bg-cyan-50 hover:shadow-lg hover:shadow-white/20"
            >
              {see_news_ad.ad_cta.cta_text}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href={see_news_ad.ad_cta_2.cta_link}
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 px-6 py-3 text-base font-semibold text-white transition-all hover:border-white hover:bg-white/10"
            >
              {see_news_ad.ad_cta_2.cta_text}
            </Link>
          </div>
        </div>
        {/* Illustrations peeking out from the bottom */}
        <div className="hidden md:block relative h-[340px]">
          <div className="absolute inset-x-0 top-0 flex items-end justify-center gap-4 translate-y-8">
            <DesktopMockup />
            <MobileMockup />
          </div>
        </div>
      </div>
    </div>
  );
}
