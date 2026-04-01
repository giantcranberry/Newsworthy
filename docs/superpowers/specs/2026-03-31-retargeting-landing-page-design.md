# Retargeting Campaign Landing Page — /campaigns

## Overview

A Google Ads landing page for Newsworthy.ai's retargeting campaign. The page explains how press releases can be used in a retargeting campaign — a News Marketing innovation only available through Newsworthy.ai. Targets marketing managers who understand retargeting but may be new to PR as a marketing channel.

**Route:** `/campaigns` in the website app (`apps/website`)
**Primary CTA:** Register a free account
**Secondary CTA:** Book a 30-min meeting (with free press release trial credit)
**Booking URL:** `https://tidycal.com/newsmarketer/30-minute-meeting`
**Registration URL:** `https://app.newsworthyai.com/auth/coregister/pr/newsworthy` (existing pattern)

## Page Structure (Before/After Contrast Pattern)

### Section 1 — Hero

- **Layout:** Two-column on desktop (copy left, before/after visual right), stacked on mobile
- **Background:** Light gradient (`f0f9ff` → white)
- **Eyebrow:** "A News Marketing Innovation" in cyan, uppercase, tracked
- **Headline (serif):** "Press Releases That Pay For Themselves"
- **Subhead (cyan, semibold):** "Retarget every reader. Measure every click. Close more deals."
- **Body copy:** One sentence explaining the core concept — first PR platform with built-in retargeting
- **CTAs:**
  - Primary (filled cyan): "Create Free Account" → links to coregister URL
  - Secondary (outlined): "Book a Demo →" → links to TidyCal booking URL
- **Trust signals:** "Free trial credit" / "No credit card" / "Setup in minutes"
- **Right side visual:** Two stacked cards with arrow between them:
  - Red card: "Old Way — Publish & Pray"
  - Green card: "New Way — Publish & Retarget"

### Section 2 — The Problem (Before/After Contrast)

- **Background:** White
- **Headline (serif):** "Your Best Leads Are Reading Your News." + second line in cyan: "Then They Disappear."
- **Subtext:** Brief explanation that press releases reach interested readers but there's been no way to follow up
- **Two-column comparison cards:**
  - **Without Newsworthy** (red-tinted): 5 bullet points with ✗ marks — publish, readers visit once, 82% never return, no follow-up, zero ROI
  - **With Newsworthy** (green-tinted): 5 bullet points with ✓ marks — publish, readers are pixeled, retarget with ads, nurture across web, track conversions & ROI

### Section 3 — How It Works (3 Steps)

- **Background:** Slate-50 (`f8fafc`)
- **Headline (serif):** "How News Marketing Retargeting Works"
- **Subtext:** "Three steps to turn press release readers into customers"
- **Three cards in a row** (stacked on mobile), each with:
  - Numbered circle (cyan background)
  - Title + description
  - Step 1: "Publish Your Release" — write and distribute through Newsworthy.ai
  - Step 2: "Readers Get Pixeled" — every reader on your hosted newsroom is tagged with your retargeting pixel automatically
  - Step 3: "Retarget & Convert" — follow up with targeted ads on Google, Facebook, LinkedIn

### Section 4 — Benefits / Stats

- **Background:** White
- **Headline (serif):** "Why Retarget Press Release Readers?"
- **2×2 grid of stat cards** (light blue background), each with:
  - Large stat number (cyan, bold)
  - Label
  - Brief explanation
- Cards:
  - "3–5×" — Higher Intent — news readers actively sought your story
  - "82%" — Never Return — without retargeting, readers are lost
  - "10×" — Better CTR — retargeted audiences click at higher rates
  - "1st" — Only Platform — Newsworthy.ai is the first PR platform with built-in retargeting

### Section 5 — FAQ Accordion

- **Background:** Slate-50
- **Headline (serif):** "Common Questions"
- **Shadcn Accordion component** with 5 items:
  1. "How does the retargeting pixel work?" — You add your Google/Meta/LinkedIn pixel to your Newsworthy newsroom. When readers visit your press releases, the pixel fires and adds them to your retargeting audience.
  2. "Which ad platforms can I retarget on?" — Any platform that supports retargeting pixels: Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, and more.
  3. "How many readers can I expect per release?" — Depends on your news and distribution tier. Releases typically reach hundreds to thousands of readers through our distribution network.
  4. "Do I need to write the press release myself?" — No. Book a meeting and our team can help. You also get AI-powered writing assistance in the platform.
  5. "What does the free trial include?" — One press release credit to publish and distribute. Full access to analytics and retargeting setup.

### Section 6 — Final CTA

- **Background:** Dark blue (`0c4a6e`)
- **Headline (white, serif):** "Ready to Turn News Readers Into Customers?"
- **Subtext (light blue):** "Choose the path that works for you"
- **Two side-by-side cards:**
  - **Left (white, primary):** "Start Free" — "Create your account and publish your first release with a free trial credit" — filled cyan button "Create Free Account"
  - **Right (glass/transparent, secondary):** "Talk to Us" — "Book a 30-min call and get a free press release credit — no strings attached" — outlined white button "Book a Meeting →"

## Technical Implementation

### Route & File Structure

- **Page file:** `apps/website/app/(site)/campaigns/page.tsx`
- Server component (static content, no data fetching needed)
- Uses existing `(site)` layout (navbar + footer)
- `revalidate = 3600` (static content, 1-hour cache)

### Components

All sections will be in the page file as self-contained sections. No need for separate component files since this is a single-use landing page. Uses:

- Shadcn `Accordion` for FAQ section
- Shadcn `Button` for CTAs
- Tailwind for all styling
- `font-serif` (Lora) for headlines, `font-sans` (Nunito Sans) for body
- Color palette: cyan-700/800 for accents, slate for text, matching existing site design

### Responsive Design

- Hero: 2-column → stacked on mobile
- Before/After cards: 2-column → stacked on mobile
- How It Works: 3-column → stacked on mobile
- Stats grid: 2×2 → 1-column on mobile
- CTA cards: 2-column → stacked on mobile
- All section padding reduces on mobile

### SEO / Meta

- Title: "Retarget Press Release Readers | News Marketing by Newsworthy.ai"
- Description: "Turn press release readers into customers with retargeting. The first PR platform with built-in retargeting pixels. Start free."
- OpenGraph image: Can use existing Newsworthy OG image or create a campaign-specific one later
- No `noindex` — this page should be indexable for organic discovery

### Links

- "Create Free Account" buttons → `https://app.newsworthyai.com/auth/coregister/pr/newsworthy`
- "Book a Demo / Meeting" buttons → `https://tidycal.com/newsmarketer/30-minute-meeting`
- Both links open in new tab (`target="_blank"`)

## Out of Scope

- A/B testing infrastructure (build the best single page first, iterate with data)
- Analytics event tracking beyond what Plausible already captures
- Dynamic content or personalization
- Custom OG image generation
