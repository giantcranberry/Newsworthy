import { getSiteAdBySlug } from "@/sanity/sanity-utils";
import Link from "next/link";

export default async function SeeYourNewsGutter() {
  const see_news_ad = await getSiteAdBySlug("see-your-news-here");
  return (
    <div className="rounded-xl bg-gradient-to-b from-cyan-800 via-cyan-700 to-teal-600 text-white overflow-hidden">
      <div className="relative p-6 space-y-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative space-y-4">
          {see_news_ad.subtitle && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-200">
              {see_news_ad.subtitle}
            </span>
          )}
          <h3 className="font-serif text-2xl font-semibold leading-tight">
            {see_news_ad.title}
          </h3>
          <p className="text-sm text-cyan-100 leading-relaxed">
            {see_news_ad.textContent}
          </p>

          {/* Compact mini mockup */}
          <div className="rounded-lg bg-white/10 p-3 space-y-2">
            <div className="flex items-center gap-1 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-red-400/70" />
              <div className="h-1.5 w-1.5 rounded-full bg-yellow-400/70" />
              <div className="h-1.5 w-1.5 rounded-full bg-green-400/70" />
              <div className="ml-1.5 h-2.5 flex-1 rounded-full bg-white/10" />
            </div>
            <p className="text-[10px] font-serif font-semibold text-white/90 leading-tight">
              Your Company Announces Groundbreaking New Product Launch
            </p>
            <p className="text-[8px] text-white/50 leading-snug">
              A brief summary of your press release that captures the key message...
            </p>
            <div className="flex gap-1">
              <span className="text-[7px] font-semibold text-cyan-200 bg-white/10 px-1.5 py-0.5 rounded-full">Technology</span>
              <span className="text-[7px] font-semibold text-cyan-200 bg-white/10 px-1.5 py-0.5 rounded-full">Business</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <Link
              href={see_news_ad.ad_cta.cta_link}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-cyan-800 transition-all hover:bg-cyan-50 hover:shadow-lg hover:shadow-white/20"
            >
              {see_news_ad.ad_cta.cta_text}
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href={see_news_ad.ad_cta_2.cta_link}
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-white hover:bg-white/10"
            >
              {see_news_ad.ad_cta_2.cta_text}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
