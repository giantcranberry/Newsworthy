import { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

export const revalidate = 3600;

const REGISTER_URL =
  "https://app.newsworthyai.com/auth/coregister/pr/newsworthy";
const BOOKING_URL = "https://tidycal.com/newsmarketer/30-minute-meeting";

export const metadata: Metadata = {
  title: "Retarget Press Release Readers | News Marketing by Newsworthy.ai",
  description:
    "Turn press release readers into customers with retargeting. The first PR platform with built-in retargeting pixels. Start free.",
  openGraph: {
    title: "Retarget Press Release Readers | News Marketing by Newsworthy.ai",
    description:
      "Turn press release readers into customers with retargeting. The first PR platform with built-in retargeting pixels. Start free.",
    images: [
      {
        url: "https://newsworthy.ai/nw-social-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function CampaignsPage() {
  return (
    <>
      {/* ── Section 1: Hero ── */}
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Copy */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-sm font-bold uppercase tracking-widest text-cyan-700 mb-4">
                A News Marketing Innovation
              </p>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Press Releases That Pay&nbsp;For&nbsp;Themselves
              </h1>
              <p className="mt-4 text-lg font-semibold text-cyan-700">
                Retarget every reader. Measure every click. Close more deals.
              </p>
              <p className="mt-4 text-lg text-gray-600 max-w-lg mx-auto lg:mx-0">
                The first press release platform with built-in retargeting. Turn
                the people who read your news into customers — with ads that
                follow up automatically.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link
                  href={REGISTER_URL}
                  target="_blank"
                  className="inline-block rounded-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-8 py-3 transition-colors"
                >
                  Create Free Account
                </Link>
                <Link
                  href={BOOKING_URL}
                  target="_blank"
                  className="inline-block rounded-full border-2 border-cyan-700 text-cyan-700 hover:bg-cyan-50 font-semibold px-8 py-3 transition-colors"
                >
                  Book a Demo &rarr;
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4 justify-center lg:justify-start text-sm text-gray-400">
                <span>&#10003; Free trial credit</span>
                <span>&#10003; No credit card</span>
                <span>&#10003; Setup in minutes</span>
              </div>
            </div>

            {/* Before / After visual cards */}
            <div className="flex-1 flex flex-col items-center gap-4 max-w-sm w-full">
              <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl" role="img" aria-label="newspaper">
                    📰
                  </span>
                  <span className="font-bold text-red-700">
                    Old Way: Publish &amp; Pray
                  </span>
                </div>
                <p className="text-sm text-red-600/80">
                  You send your press release and hope someone notices. No
                  tracking, no follow-up, no ROI.
                </p>
              </div>

              <span className="text-2xl text-gray-300">&darr;</span>

              <div className="w-full rounded-xl border border-green-200 bg-green-50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl" role="img" aria-label="target">
                    🎯
                  </span>
                  <span className="font-bold text-green-700">
                    New Way: Publish &amp; Retarget
                  </span>
                </div>
                <p className="text-sm text-green-600/80">
                  Every reader is pixeled. Ads follow up automatically. You
                  measure real ROI.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Before / After Contrast ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Your Best Leads Are Reading Your News.{" "}
            <span className="text-cyan-700">Then They Disappear.</span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Most press release services deliver impressions but zero follow-up.
            Readers land on your release, skim the headline, and vanish — taking
            their purchase intent with them.
          </p>

          <div className="mt-12 grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
            {/* Without */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h3 className="font-bold text-red-700 text-lg mb-4">
                Without Newsworthy
              </h3>
              <ul className="space-y-3 text-sm text-red-700/90">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>Publish your release and cross your fingers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>Readers visit once and never come back</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>82% of interested readers never return</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>No follow-up, no nurture sequence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>Zero visibility into ROI</span>
                </li>
              </ul>
            </div>

            {/* With */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <h3 className="font-bold text-green-700 text-lg mb-4">
                With Newsworthy
              </h3>
              <ul className="space-y-3 text-sm text-green-700/90">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>Publish your release with confidence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>Every reader is pixeled automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>Retarget readers with ads across the web</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>Nurture prospects across every channel</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>Track conversions and prove ROI</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: How It Works ── */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            How News Marketing Retargeting Works
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Three steps to turn press release readers into customers
          </p>

          <div className="mt-12 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: 1,
                title: "Publish Your Release",
                description:
                  "Write and distribute your press release through Newsworthy. It goes out to our network of news sites, Google News, and media outlets.",
              },
              {
                step: 2,
                title: "Readers Get Pixeled",
                description:
                  "Your retargeting pixel fires on every reader who views your release. They are automatically added to your custom ad audience.",
              },
              {
                step: 3,
                title: "Retarget & Convert",
                description:
                  "Run follow-up ads on Google, Meta, LinkedIn, and more. Nurture warm leads who already showed interest in your news.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white border border-gray-200 rounded-xl p-6 text-center"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-700 text-white text-lg font-bold">
                  {item.step}
                </div>
                <h3 className="font-serif text-xl font-bold mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4: Benefits / Stats ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            Why Retarget Press Release Readers?
          </h2>

          <div className="mt-12 grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                stat: "3-5x",
                label: "Higher Intent",
                description:
                  "People reading your news are actively interested in your industry. They convert at 3-5x the rate of cold audiences.",
              },
              {
                stat: "82%",
                label: "Never Return",
                description:
                  "Without retargeting, 82% of press release readers never come back. Retargeting keeps you in front of them.",
              },
              {
                stat: "10x",
                label: "Better CTR",
                description:
                  "Retargeting ads achieve up to 10x higher click-through rates compared to standard display advertising.",
              },
              {
                stat: "1st",
                label: "Only Platform",
                description:
                  "Newsworthy is the first and only press release platform with built-in retargeting pixel support.",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-sky-50 rounded-xl p-6 text-center"
              >
                <p className="text-4xl md:text-5xl font-bold text-cyan-700">
                  {item.stat}
                </p>
                <p className="mt-2 font-bold text-gray-900">{item.label}</p>
                <p className="mt-2 text-sm text-gray-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 5: FAQ Accordion ── */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-center">
            Common Questions
          </h2>

          <div className="mt-12 max-w-2xl mx-auto">
            <Accordion type="single" collapsible>
              <AccordionItem value="pixel">
                <AccordionTrigger className="text-left text-base">
                  How does the retargeting pixel work?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  You add your Google/Meta/LinkedIn pixel to your Newsworthy
                  newsroom. When readers visit your press releases, the pixel
                  fires and adds them to your retargeting audience — just like it
                  would on your own website.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="platforms">
                <AccordionTrigger className="text-left text-base">
                  Which ad platforms can I retarget on?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Any platform that supports retargeting pixels: Google Ads, Meta
                  (Facebook and Instagram), LinkedIn, Twitter/X, and more. If it
                  uses a JavaScript pixel, it works with Newsworthy.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="readers">
                <AccordionTrigger className="text-left text-base">
                  How many readers can I expect per release?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  It depends on your news and distribution tier. Releases
                  typically reach hundreds to thousands of readers through our
                  distribution network of news sites and media outlets.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="writing">
                <AccordionTrigger className="text-left text-base">
                  Do I need to write the press release myself?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  No. Book a meeting and our team can help you craft the perfect
                  release. You also get AI-powered writing assistance built into
                  the platform to guide you through the process.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="trial">
                <AccordionTrigger className="text-left text-base">
                  What does the free trial include?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  One press release credit to publish and distribute through our
                  network. Full access to analytics, your hosted newsroom, and
                  retargeting pixel setup.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ── */}
      <section className="bg-sky-950">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white">
            Ready to Turn News Readers Into&nbsp;Customers?
          </h2>
          <p className="mt-4 text-lg text-sky-300">
            Choose the path that works for you
          </p>

          <div className="mt-12 grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {/* Primary: Start Free */}
            <div className="rounded-xl bg-white p-8 text-center">
              <h3 className="font-serif text-xl font-bold text-gray-900">
                Start Free
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                Create your account, set up your newsroom, and publish your
                first release with a free credit. No credit card required.
              </p>
              <Link
                href={REGISTER_URL}
                target="_blank"
                className="mt-6 inline-block rounded-full bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-8 py-3 transition-colors"
              >
                Create Free Account
              </Link>
            </div>

            {/* Secondary: Talk to Us */}
            <div className="rounded-xl bg-white/10 border border-white/20 p-8 text-center">
              <h3 className="font-serif text-xl font-bold text-white">
                Talk to Us
              </h3>
              <p className="mt-3 text-sm text-sky-200">
                Want a walkthrough? Book a 30-minute meeting with our team and
                we will show you how retargeting works with your press releases.
              </p>
              <Link
                href={BOOKING_URL}
                target="_blank"
                className="mt-6 inline-block rounded-full border-2 border-white text-white hover:bg-white/10 font-semibold px-8 py-3 transition-colors"
              >
                Book a Meeting &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
