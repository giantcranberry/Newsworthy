# Retargeting Campaign Landing Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/campaigns` landing page in the website app that explains press release retargeting and drives visitors to register or book a meeting.

**Architecture:** Single server component page at `apps/website/app/(site)/campaigns/page.tsx`. Uses existing `(site)` layout (navbar + footer). Accordion FAQ section is a client component imported from shadcn. All other sections are static markup with Tailwind.

**Tech Stack:** Next.js server component, Tailwind CSS, shadcn Accordion, Lora (serif) + Nunito Sans (sans) fonts from existing layout.

**Spec:** `docs/superpowers/specs/2026-03-31-retargeting-landing-page-design.md`

---

### Task 1: Create the page file with metadata and Hero section

**Files:**
- Create: `apps/website/app/(site)/campaigns/page.tsx`

- [ ] **Step 1: Create the page file with exports and metadata**

Create `apps/website/app/(site)/campaigns/page.tsx`:

```tsx
import { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const revalidate = 3600;

const REGISTER_URL = "https://app.newsworthyai.com/auth/coregister/pr/newsworthy";
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
    <div>
      {/* Section 1: Hero */}
      <section className="bg-gradient-to-b from-sky-50 to-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            {/* Left: Copy */}
            <div className="flex-1 text-center lg:text-left">
              <p className="text-sm font-bold uppercase tracking-widest text-cyan-700 mb-4">
                A News Marketing Innovation
              </p>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight font-serif leading-tight">
                Press Releases That{" "}
                <span className="block">Pay For Themselves</span>
              </h1>
              <p className="mt-4 text-lg font-semibold text-cyan-700">
                Retarget every reader. Measure every click. Close more deals.
              </p>
              <p className="mt-3 text-base text-gray-500 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                The first press release platform with built-in retargeting. Turn
                the people who read your news into customers — with ads that
                follow up automatically.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link
                  href={REGISTER_URL}
                  target="_blank"
                  className="inline-block rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-8 py-3 text-center transition-colors"
                >
                  Create Free Account
                </Link>
                <Link
                  href={BOOKING_URL}
                  target="_blank"
                  className="inline-block rounded-lg border border-cyan-700 text-cyan-700 hover:bg-cyan-50 font-semibold px-8 py-3 text-center transition-colors"
                >
                  Book a Demo →
                </Link>
              </div>
              <div className="mt-4 flex gap-4 justify-center lg:justify-start text-sm text-gray-400">
                <span>✓ Free trial credit</span>
                <span>✓ No credit card</span>
                <span>✓ Setup in minutes</span>
              </div>
            </div>
            {/* Right: Before/After visual */}
            <div className="flex-shrink-0 w-full max-w-xs flex flex-col items-center gap-3">
              <div className="w-full rounded-xl bg-red-50 border border-red-200 p-5 text-center">
                <div className="text-3xl mb-2">📰</div>
                <p className="font-semibold text-red-800 text-sm">Old Way</p>
                <p className="text-red-600 text-xs mt-1">Publish &amp; Pray</p>
              </div>
              <div className="text-2xl text-cyan-700">⬇</div>
              <div className="w-full rounded-xl bg-green-50 border border-green-200 p-5 text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="font-semibold text-green-800 text-sm">New Way</p>
                <p className="text-green-600 text-xs mt-1">
                  Publish &amp; Retarget
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run: `cd /home/david/Dev/nextjs/newsworthy && bun run dev:website`

Open `http://localhost:3000/campaigns` in the browser. Verify:
- Page renders with navbar and footer (from `(site)` layout)
- Hero section shows with headline, CTAs, and before/after visual
- Both CTA links open correct URLs in new tabs
- Responsive: stacks vertically on mobile

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add /campaigns landing page with hero section"
```

---

### Task 2: Add the Before/After Contrast section

**Files:**
- Modify: `apps/website/app/(site)/campaigns/page.tsx`

- [ ] **Step 1: Add Section 2 after the Hero closing `</section>` tag**

Insert after the Hero `</section>` and before the closing `</div>`:

```tsx
      {/* Section 2: Before/After Contrast */}
      <section className="bg-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-serif leading-tight">
              Your Best Leads Are Reading Your News.
              <span className="block text-cyan-700 mt-1">
                Then They Disappear.
              </span>
            </h2>
            <p className="mt-4 text-gray-500 leading-relaxed">
              Every press release you publish reaches hundreds or thousands of
              interested readers. Until now, there was no way to follow up with
              them.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Without */}
            <div className="rounded-xl bg-red-50 border border-red-200 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-red-800 mb-4">
                Without Newsworthy
              </p>
              <ul className="space-y-3 text-sm text-red-900">
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  Publish press release
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  Readers visit once
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  82% never return
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  No way to follow up
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-400 mt-0.5">✗</span>
                  Zero measurable ROI
                </li>
              </ul>
            </div>
            {/* With */}
            <div className="rounded-xl bg-green-50 border border-green-200 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-green-800 mb-4">
                With Newsworthy
              </p>
              <ul className="space-y-3 text-sm text-green-900">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Publish press release
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Readers are pixeled
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Retarget with your ads
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Nurture across the web
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">✓</span>
                  Track conversions &amp; ROI
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/campaigns`. Verify:
- Section renders below the hero
- Two cards side by side on desktop, stacked on mobile
- Red/green contrast is clear and readable

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add before/after contrast section to campaigns page"
```

---

### Task 3: Add the How It Works section

**Files:**
- Modify: `apps/website/app/(site)/campaigns/page.tsx`

- [ ] **Step 1: Add Section 3 after the Before/After `</section>`**

Insert after Section 2's `</section>`:

```tsx
      {/* Section 3: How It Works */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-serif">
              How News Marketing Retargeting Works
            </h2>
            <p className="mt-3 text-gray-500">
              Three steps to turn press release readers into customers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-lg font-bold text-cyan-700">
                1
              </div>
              <h3 className="text-base font-semibold mb-2">
                Publish Your Release
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Write and distribute your press release through Newsworthy.ai's
                network of news sites and media outlets.
              </p>
            </div>
            {/* Step 2 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-lg font-bold text-cyan-700">
                2
              </div>
              <h3 className="text-base font-semibold mb-2">
                Readers Get Pixeled
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Every reader on your hosted newsroom is tagged with your
                retargeting pixel automatically — no extra setup.
              </p>
            </div>
            {/* Step 3 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-lg font-bold text-cyan-700">
                3
              </div>
              <h3 className="text-base font-semibold mb-2">
                Retarget &amp; Convert
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Follow up with targeted ads on Google, Facebook, and LinkedIn —
                turn one-time readers into leads and customers.
              </p>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/campaigns`. Verify:
- Three step cards render in a row on desktop, stacked on mobile
- Numbered circles are cyan
- Slate-50 background differentiates this section

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add how-it-works section to campaigns page"
```

---

### Task 4: Add the Benefits/Stats section

**Files:**
- Modify: `apps/website/app/(site)/campaigns/page.tsx`

- [ ] **Step 1: Add Section 4 after How It Works `</section>`**

Insert after Section 3's `</section>`:

```tsx
      {/* Section 4: Benefits / Stats */}
      <section className="bg-white">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
            Why Retarget Press Release Readers?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div className="rounded-xl bg-sky-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-cyan-700">3–5×</p>
              <p className="mt-2 font-semibold text-sm">Higher Intent</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                News readers actively sought out your story — they're warmer
                than cold traffic
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-cyan-700">82%</p>
              <p className="mt-2 font-semibold text-sm">Never Return</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Without retargeting, the vast majority of engaged readers are
                lost forever
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-cyan-700">10×</p>
              <p className="mt-2 font-semibold text-sm">Better CTR</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Retargeted audiences click through at dramatically higher rates
                than cold ads
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-6 text-center">
              <p className="text-4xl font-extrabold text-cyan-700">1st</p>
              <p className="mt-2 font-semibold text-sm">Only Platform</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Newsworthy.ai is the first and only PR platform with built-in
                retargeting
              </p>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/campaigns`. Verify:
- 2x2 grid of stat cards on desktop, single column on mobile
- Large cyan stat numbers are prominent
- Sky-50 card backgrounds provide contrast

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add benefits/stats section to campaigns page"
```

---

### Task 5: Add the FAQ Accordion section

**Files:**
- Modify: `apps/website/app/(site)/campaigns/page.tsx`

**Note:** The `Accordion` component from `@/components/ui/accordion` is a client component (has `"use client"` directive). It's already imported at the top of the file from Task 1. Since our page is a server component, Next.js handles the client/server boundary automatically when rendering client components inside server components — no changes needed.

- [ ] **Step 1: Add Section 5 after Benefits `</section>`**

Insert after Section 4's `</section>`:

```tsx
      {/* Section 5: FAQ */}
      <section className="bg-slate-50">
        <div className="mx-auto max-w-2xl px-5 py-16 lg:py-24">
          <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
            Common Questions
          </h2>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pixel">
              <AccordionTrigger className="text-left text-base font-semibold">
                How does the retargeting pixel work?
              </AccordionTrigger>
              <AccordionContent className="text-gray-500 leading-relaxed">
                You add your Google, Meta, or LinkedIn retargeting pixel to your
                Newsworthy newsroom. When readers visit your press releases, the
                pixel fires and adds them to your retargeting audience — just
                like it would on your own website.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="platforms">
              <AccordionTrigger className="text-left text-base font-semibold">
                Which ad platforms can I retarget on?
              </AccordionTrigger>
              <AccordionContent className="text-gray-500 leading-relaxed">
                Any platform that supports retargeting pixels: Google Ads, Meta
                (Facebook and Instagram), LinkedIn, Twitter/X, and more. If it
                uses a JavaScript pixel, it works with Newsworthy.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="readers">
              <AccordionTrigger className="text-left text-base font-semibold">
                How many readers can I expect per release?
              </AccordionTrigger>
              <AccordionContent className="text-gray-500 leading-relaxed">
                It depends on your news and distribution tier. Releases
                typically reach hundreds to thousands of readers through our
                distribution network of news sites and media outlets.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="writing">
              <AccordionTrigger className="text-left text-base font-semibold">
                Do I need to write the press release myself?
              </AccordionTrigger>
              <AccordionContent className="text-gray-500 leading-relaxed">
                No. Book a meeting and our team can help you craft the perfect
                release. You also get AI-powered writing assistance built into
                the platform to guide you through the process.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="trial">
              <AccordionTrigger className="text-left text-base font-semibold">
                What does the free trial include?
              </AccordionTrigger>
              <AccordionContent className="text-gray-500 leading-relaxed">
                One press release credit to publish and distribute through our
                network. Full access to analytics, your hosted newsroom, and
                retargeting pixel setup.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>
```

- [ ] **Step 2: Verify in browser**

Reload `http://localhost:3000/campaigns`. Verify:
- Accordion renders with 5 items
- Clicking an item expands it with an animation
- Only one item open at a time (collapsible single mode)
- ChevronDown icon rotates on open

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add FAQ accordion section to campaigns page"
```

---

### Task 6: Add the Final CTA section

**Files:**
- Modify: `apps/website/app/(site)/campaigns/page.tsx`

- [ ] **Step 1: Add Section 6 after FAQ `</section>`**

Insert after Section 5's `</section>`, before the closing `</div>` of the page:

```tsx
      {/* Section 6: Final CTA */}
      <section className="bg-sky-950">
        <div className="mx-auto max-w-screen-xl px-5 py-16 lg:py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-white">
              Ready to Turn News Readers Into Customers?
            </h2>
            <p className="mt-3 text-sky-300">
              Choose the path that works for you
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Primary: Register */}
            <div className="rounded-xl bg-white p-8 text-center">
              <h3 className="text-xl font-bold mb-2">Start Free</h3>
              <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                Create your account and publish your first release with a free
                trial credit.
              </p>
              <Link
                href={REGISTER_URL}
                target="_blank"
                className="inline-block rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-semibold px-8 py-3 transition-colors"
              >
                Create Free Account
              </Link>
            </div>
            {/* Secondary: Book meeting */}
            <div className="rounded-xl bg-white/10 border border-white/20 p-8 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Talk to Us</h3>
              <p className="text-sm text-sky-200 mb-6 leading-relaxed">
                Book a 30-min call and get a free press release credit — no
                strings attached.
              </p>
              <Link
                href={BOOKING_URL}
                target="_blank"
                className="inline-block rounded-lg border border-white text-white hover:bg-white/10 font-semibold px-8 py-3 transition-colors"
              >
                Book a Meeting →
              </Link>
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Verify the complete page in browser**

Reload `http://localhost:3000/campaigns`. Scroll through the entire page and verify:
- All 6 sections render in order: Hero → Before/After → How It Works → Stats → FAQ → Final CTA
- Dark sky-950 background on final CTA creates strong visual contrast
- Both CTA buttons link to correct URLs
- Page is fully responsive on mobile (check with devtools)
- Navbar and footer from the `(site)` layout frame the page

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/\(site\)/campaigns/page.tsx
git commit -m "feat: add final CTA section, complete campaigns landing page"
```
