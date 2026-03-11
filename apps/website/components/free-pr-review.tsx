import Image from "next/image";
import Link from "next/link";

export default function FreePrReview() {
  return (
    <div className="flex flex-col items-center text-center border border-emerald-200 rounded-lg p-4 h-full w-full max-w-[328px] bg-gradient-to-b from-emerald-50 to-amber-50 hover:shadow-md transition-shadow duration-300">
      {/* Circular headshot */}
      <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-emerald-100 mb-2">
        <Image
          src="https://cdn1.newsworthy.ai/expert-pr-reviews/pr-expert-david.png"
          width={128}
          height={128}
          className="w-full h-full object-cover object-top"
          alt="David McInnis, PR Expert"
        />
      </div>

      {/* Logo */}
      <Image
        src="https://cdn1.newsworthy.ai/expert-pr-reviews/expert-pr-review-logo.svg"
        width={240}
        height={1}
        alt="Expert PR Review"
        className="mb-4"
      />

      {/* Title */}
      <h2 className="font-serif text-lg leading-snug mb-1">Free Expert Press Release Review</h2>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4">
        Unlock the Marketing Magic in Your PR with David McInnis
      </p>

      {/* CTA */}
      <Link
        href="https://tidycal.com/newsmarketer/expert-press-release-review"
        className="inline-flex items-center gap-2 mt-2 bg-green-700 py-2 px-4 border-2 border-green-700 text-white hover:bg-green-800 hover:border-green-800 rounded-lg text-sm font-semibold transition-all hover:shadow-lg"
      >
        Book Your Free Review
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </Link>
    </div>
  );
}
