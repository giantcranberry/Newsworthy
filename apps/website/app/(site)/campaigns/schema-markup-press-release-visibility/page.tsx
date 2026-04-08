import { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

const GOOGLE_ADS_ID = "AW-18056538801";

export const revalidate = 3600;

const REGISTER_URL =
  "https://app.newsworthyai.com/auth/coregister/pr/newsworthy";
const BOOKING_URL = "https://tidycal.com/newsmarketer/30-minute-meeting";

export const metadata: Metadata = {
  title:
    "JSON-LD Schema Markup for Press Releases | AI Visibility by Newsworthy.ai",
  description:
    "The first newswire with deep JSON-LD schema markup built into every press release. Get found by search engines, AI systems, and LLMs automatically. No technical knowledge required.",
  openGraph: {
    title:
      "JSON-LD Schema Markup for Press Releases | AI Visibility by Newsworthy.ai",
    description:
      "The first newswire with deep JSON-LD schema markup built into every press release. Get found by search engines, AI systems, and LLMs automatically.",
    images: [
      {
        url: "https://newsworthy.ai/nw-social-image.jpg",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function SchemaMarkupPage() {
  return (
    <>
      {/* Google Ads Remarketing tag */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script
        id="google-ads-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `,
        }}
      />

      {/* ── Section 1: Hero ── */}
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Copy */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-sm font-bold uppercase tracking-widest text-cyan-700 mb-4">
                The Schema-First Newswire
              </p>
              <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Press Releases That Machines Can&nbsp;Actually&nbsp;Read
              </h1>
              <p className="mt-4 text-lg font-semibold text-cyan-700">
                Built-in JSON-LD schema markup. Automatic AI visibility. Zero
                technical&nbsp;setup.
              </p>
              <p className="mt-4 text-lg text-gray-600 max-w-lg mx-auto lg:mx-0">
                The first and only newswire that builds deep, standards-compliant
                JSON-LD structured data directly into every press release —
                making your news discoverable by search engines, AI systems, and
                large language models.
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
                <span>&#10003; Schema included free</span>
              </div>
            </div>

            {/* Before / After visual cards */}
            <div className="flex-1 flex flex-col items-center gap-4 max-w-sm w-full">
              <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl" role="img" aria-label="document">
                    📄
                  </span>
                  <span className="font-bold text-red-700">
                    Old Way: Flat, Unstructured Text
                  </span>
                </div>
                <p className="text-sm text-red-600/80">
                  Your press release is just a wall of text. Search engines
                  guess at meaning. AI systems skip it entirely.
                </p>
              </div>

              <span className="text-2xl text-gray-300">&darr;</span>

              <div className="w-full rounded-xl border border-green-200 bg-green-50 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl" role="img" aria-label="code">
                    🧬
                  </span>
                  <span className="font-bold text-green-700">
                    New Way: Schema-First Distribution
                  </span>
                </div>
                <p className="text-sm text-green-600/80">
                  Every release carries rich JSON-LD markup. Search engines
                  understand it. AI systems cite it. LLMs trust it.
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
            Search Has Moved Beyond Keywords.{" "}
            <span className="text-cyan-700">
              Has Your Press Release Kept&nbsp;Up?
            </span>
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Google, ChatGPT, Perplexity, and AI Overviews don&apos;t just read
            your words — they parse your data. Without structured markup, your
            press release is invisible to the systems that now decide what gets
            surfaced.
          </p>

          <div className="mt-12 grid md:grid-cols-2 gap-8 max-w-3xl mx-auto text-left">
            {/* Without */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <h3 className="font-bold text-red-700 text-lg mb-4">
                Without Schema Markup
              </h3>
              <ul className="space-y-3 text-sm text-red-700/90">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>
                    Search engines guess at your content&apos;s meaning
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>No rich results, knowledge panels, or news cards</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>
                    AI systems can&apos;t identify who published or when
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>LLMs skip your content for better-structured sources</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10007;</span>
                  <span>
                    Invisible to voice assistants and AI discovery tools
                  </span>
                </li>
              </ul>
            </div>

            {/* With */}
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
              <h3 className="font-bold text-green-700 text-lg mb-4">
                With Newsworthy Schema
              </h3>
              <ul className="space-y-3 text-sm text-green-700/90">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>
                    Machines understand your content with precision
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>
                    Eligible for rich results, news features, and knowledge
                    panels
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>
                    Clear attribution — who, when, where, and why
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>
                    AI and LLMs cite your releases in generated answers
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">&#10003;</span>
                  <span>
                    Discoverable across voice, search, and AI platforms
                  </span>
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
            How Schema-First Distribution Works
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            No developers. No plugins. No extra cost. Just press releases built
            for the AI&nbsp;era.
          </p>

          <div className="mt-12 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: 1,
                title: "Set Up Your Brand Profile",
                description:
                  "Enter your company details — name, industry, contacts, and location. Newsworthy automatically generates your organization's JSON-LD schema from this information.",
              },
              {
                step: 2,
                title: "Write & Submit Your Release",
                description:
                  "Create your press release using our AI-assisted editor. As you write, the platform maps your content — quotes, dates, topics — into standards-compliant structured data.",
              },
              {
                step: 3,
                title: "Distribute with Built-In Schema",
                description:
                  "Your release goes out to our distribution network carrying deep JSON-LD markup. Search engines and AI systems can immediately parse, classify, and surface your news.",
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
            Why Schema Markup Matters for Press&nbsp;Releases
          </h2>

          <div className="mt-12 grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {[
              {
                stat: "1st",
                label: "Schema-First Newswire",
                description:
                  "Newsworthy.ai is the first and only newswire to build deep JSON-LD schema markup directly into its platform. No other service comes close.",
              },
              {
                stat: "2.5x",
                label: "More Search Visibility",
                description:
                  "Pages with structured data are up to 2.5x more likely to appear in rich results, knowledge panels, and prominent search features.",
              },
              {
                stat: "$0",
                label: "Extra Cost",
                description:
                  "Schema markup is included with every press release at every distribution tier. No upcharge, no add-on, no developer required.",
              },
              {
                stat: "100%",
                label: "Automatic",
                description:
                  "Every release gets full schema markup generated from your brand profile and content. Zero technical knowledge needed.",
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

      {/* ── Section 5: What Gets Marked Up ── */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold">
            What Our Schema Markup Covers
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Every press release includes structured data for all of these
            elements — automatically generated, standards-compliant, and ready
            for Google, Bing, and AI&nbsp;systems.
          </p>

          <div className="mt-12 grid sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto text-left">
            {[
              {
                title: "Publishing Organization",
                description:
                  "Company name, logo, URL, contact info, and industry classification",
              },
              {
                title: "Article Metadata",
                description:
                  "Headline, date published, date modified, author, and word count",
              },
              {
                title: "Location Data",
                description:
                  "Dateline city, state, and country mapped to geographic schema",
              },
              {
                title: "Quotes & Attribution",
                description:
                  "Named quotes linked to identified people within the organization",
              },
              {
                title: "Content Classification",
                description:
                  "Industry, subject matter, and topic keywords as structured categories",
              },
              {
                title: "Distribution Context",
                description:
                  "Publisher identity, distribution network, and content provenance",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: FAQ Accordion ── */}
      <section className="bg-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-center">
            Common Questions
          </h2>

          <div className="mt-12 max-w-2xl mx-auto">
            <Accordion type="single" collapsible>
              <AccordionItem value="what-is-json-ld">
                <AccordionTrigger className="text-left text-base">
                  What is JSON-LD schema markup?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  JSON-LD (JavaScript Object Notation for Linked Data) is the
                  structured data format recommended by Google for helping search
                  engines and AI systems understand web content. It tells
                  machines exactly what your press release is about — who
                  published it, when, where, and why — in a format they can
                  parse instantly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="technical">
                <AccordionTrigger className="text-left text-base">
                  Do I need technical knowledge to use this?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Not at all. The schema markup is generated automatically from
                  the information you provide when setting up your brand profile
                  and writing your press release. You never see or touch any
                  code. A small business owner gets the same structured data
                  advantage as a Fortune 500 company with a full SEO team.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ai-visibility">
                <AccordionTrigger className="text-left text-base">
                  How does schema markup help with AI visibility?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  AI systems like ChatGPT, Google AI Overviews, and Perplexity
                  prefer structured, well-attributed content when generating
                  answers. Schema markup gives these systems clear signals about
                  your content&apos;s source, credibility, and context — making
                  it far more likely to be cited in AI-generated responses.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cost">
                <AccordionTrigger className="text-left text-base">
                  Is there an extra cost for schema markup?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  No. JSON-LD schema markup is included as a standard feature
                  with every press release at every distribution tier. There is
                  no premium add-on, no per-release fee, and no technical setup
                  required.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="other-newswires">
                <AccordionTrigger className="text-left text-base">
                  Don&apos;t other newswires offer schema markup?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  Most newswires treat structured data as an afterthought, if
                  they address it at all. Newsworthy.ai is the first and only
                  newswire to build deep, automated JSON-LD schema markup
                  directly into the press release creation and distribution
                  workflow. It&apos;s not a bolt-on — it&apos;s foundational to
                  the platform.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="aio-geo">
                <AccordionTrigger className="text-left text-base">
                  What are AIO and GEO?
                </AccordionTrigger>
                <AccordionContent className="text-gray-600">
                  AIO (AI Optimization) and GEO (Generative Engine
                  Optimization) are the next evolution of SEO. As search shifts
                  from links to AI-generated answers, structured data becomes
                  the foundation for visibility. Newsworthy.ai is built from the
                  ground up for this new landscape.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* ── Section 7: Final CTA ── */}
      <section className="bg-sky-950">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24 text-center">
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-white">
            Ready to Make Your Press Releases
            AI&#8209;Visible?
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
                Create your account, set up your brand profile, and publish your
                first schema-enhanced release with a free credit. No credit card
                required.
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
                Want to see the schema markup in action? Book a 30-minute
                meeting and we will walk you through how structured data powers
                AI-era press release visibility.
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
