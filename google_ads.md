# Google Ads Integration

## Overview

Newsworthy.ai offers automated Google Search Ads promotion for press releases. When a release is published, the system creates a Google Search campaign that drives traffic to the news article page (`newsworthy.ai/news/...`), where the company's retargeting pixels fire on every reader. This closes the loop:

**PR → Google Ad → Reader lands on article → Pixel fires → User retargets with their own ads**

All ads run under Newsworthy's single Google Ads account. Each campaign gets a total budget cap set either by product pricing or editor discretion.

---

## Two Flows

### Flow 1: Customer Purchases Ad Boost

1. **Upgrades Step** — During the PR wizard (Step 6: Upgrades), the customer sees "Google Ads Boost" as a purchasable addon alongside other distribution upgrades (Yahoo, Enhanced, etc.)
2. **Payment** — Customer adds it to cart and pays via Stripe. Price is $15 (includes 25% markup over the ~$11 ad budget).
3. **Record Created** — On payment confirmation, an `ad_campaigns` record is created with status `pending` and `budget_amount` derived from the product price (price × 0.75).
4. **Editorial Approval** — When an editor approves the release, the system detects the pending ad campaign and auto-launches it.
5. **Google Ads Created** — AI generates ad copy (headlines, descriptions, keywords) from the PR content, then creates a full Google Ads Search campaign in PAUSED state.
6. **Google Review** — Google reviews the ad (typically 1 business day, can take up to 2).
7. **Auto-Enable** — The cron job checks review status periodically. Once Google approves, the campaign is automatically enabled.
8. **Campaign Runs** — Ad serves on Google Search until budget is exhausted or end date is reached (30 days from launch).
9. **Completion** — Cron marks the campaign as `completed` when budget runs out or end date passes.

### Flow 2: Editor/Admin Adds Ad Spend

1. **Editorial Review** — On the editorial review page, there is a "Google Ads Spend" field below the Feature Release checkbox.
2. **Editor Enters Amount** — The editor types a dollar amount (e.g., `11`). This is the actual Google Ads budget, not marked up. Leave blank for no ad campaign.
3. **Approve** — When the editor clicks Approve, the system creates (or updates) an `ad_campaigns` record with the specified budget.
4. **Steps 5-9 from Flow 1** — Same process: AI generates copy, Google campaign created in PAUSED state, cron enables after Google approval, runs until budget exhausted.

If the customer already purchased an ad boost AND the editor enters an amount, the editor's amount overrides the budget.

---

## Campaign Architecture

Each press release gets one Google Ads campaign with:

- **Campaign Type:** Search (targets people searching related terms)
- **Ad Format:** Responsive Search Ad (RSA) — 5 headlines, 3 descriptions. Google optimizes combinations.
- **Bidding:** Maximize Clicks with $2.00 CPC ceiling
- **Budget:** Total campaign budget (hard cap — Google guarantees spend will not exceed this)
- **Duration:** 30 days from launch
- **Network:** Google Search only (no Display, no Search Partners)
- **Keywords:** 5-10 AI-generated keywords (mix of broad, phrase, and exact match)
- **Landing Page:** The newsworthy.ai article URL

### AI Ad Copy Generation

The system uses GPT-4o to generate ad copy from the press release content:

- **5 headlines** (max 30 characters each) — newsworthy, attention-grabbing, includes company name
- **3 descriptions** (max 90 characters each) — expands on the news angle with a call to action
- **5-10 keywords** — company name, industry terms, location terms

If AI generation fails, a template-based fallback generates basic copy from the PR title and abstract.

### Character Limits (Google enforced)

| Element | Max Length |
|---------|-----------|
| Headline | 30 characters |
| Description | 90 characters |
| Final URL | 2048 characters |

---

## Campaign Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Purchased/created, waiting for release to be approved |
| `creating` | API call to Google Ads in progress |
| `review` | Ad submitted to Google, awaiting their policy review |
| `active` | Ad approved by Google and serving |
| `paused` | Manually paused by editor/admin |
| `completed` | Budget exhausted or campaign end date reached |
| `failed` | API error during creation |
| `disapproved` | Google rejected the ad for policy violations |

---

## Google Ad Review & Timing

### How Long Does Google Review Take?

- **Most ads:** Approved within 1 business day
- **Some ads:** Can take up to 2 business days
- **Policy-sensitive content:** May take longer or get disapproved

### Speeding Up Approval

There is no way to pay for or request faster review from Google. However, the system is designed to handle this:

1. **Campaigns are created PAUSED** — The ad enters Google's review queue immediately, but doesn't serve until approved and enabled.
2. **Cron auto-enables** — Once Google approves, the next cron run enables the campaign automatically.

### Recommended Timing

**Submit releases at least 2 days before the desired publish date.** This gives Google time to review the ad so it's ready to serve the moment the release goes live.

The campaign `start_date` is set to the day the campaign is created (approval day), and `end_date` is 30 days later. If the release has a future `release_at` date, the ad may start serving before the article is live — but since the campaign starts PAUSED and requires Google approval (1-2 days), this natural delay usually aligns well.

**Future enhancement:** Set `start_date_time` on the Google campaign to match the release's `release_at` date, so the ad only starts serving when the article is actually published. This would be the ideal setup for scheduled releases.

---

## Monitoring & Metrics

### Cron Job

`POST /api/cron/ads` — Protected by `CRON_SECRET` bearer token.

Runs periodically (recommended: every 2-4 hours) and:

1. Checks `review` campaigns for Google approval status → enables approved ones
2. Updates metrics (impressions, clicks, spend) for `active` campaigns
3. Marks campaigns as `completed` when budget is exhausted or end date passed
4. Catches any `pending` campaigns whose releases are already published

**Setup:** Configure a cron scheduler (Vercel Cron, external cron, etc.) to call:

```
POST https://app.newsworthy.ai/api/cron/ads
Authorization: Bearer <CRON_SECRET>
```

### Dashboard Visibility

The Ad Campaign Card appears on:

- **Editorial Review page** — Editors see campaign status, metrics, and can launch/pause/resume
- **Editorial Edit page** — Same card for editing released PRs
- **Submission Complete page** — PR authors see their campaign status after submission

The card shows: status badge, budget, amount spent, impressions, clicks, CTR, budget progress bar, and expandable ad copy details.

---

## Database

### Table: `ad_campaigns`

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Primary key |
| `uuid` | VARCHAR(36) | Public identifier |
| `release_id` | INTEGER | FK to releases |
| `company_id` | INTEGER | FK to company |
| `user_id` | INTEGER | FK to users |
| `budget_amount` | INTEGER | Ad budget in USD |
| `amount_spent` | NUMERIC(10,2) | Actual spend tracked by cron |
| `google_campaign_id` | VARCHAR(64) | Google Ads campaign resource ID |
| `google_ad_group_id` | VARCHAR(64) | Google Ads ad group resource ID |
| `google_budget_id` | VARCHAR(64) | Google Ads budget resource ID |
| `headlines` | JSONB | AI-generated headlines array |
| `descriptions` | JSONB | AI-generated descriptions array |
| `keywords` | JSONB | AI-generated keywords array |
| `final_url` | VARCHAR(512) | Landing page URL |
| `status` | VARCHAR(32) | Campaign status (see statuses above) |
| `policy_status` | VARCHAR(32) | Google's policy review result |
| `policy_topics` | JSONB | Policy violation details if disapproved |
| `impressions` | INTEGER | Total impressions (updated by cron) |
| `clicks` | INTEGER | Total clicks (updated by cron) |
| `payment_intent_id` | VARCHAR(128) | Stripe payment ID (if user purchased) |
| `paid_at` | TIMESTAMP | When payment was confirmed |
| `campaign_start_date` | DATE | Google campaign start date |
| `campaign_end_date` | DATE | Google campaign end date |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

### Product Row

```sql
-- Product in the upgrades step (price in cents, includes 25% markup)
INSERT INTO products (display_name, short_name, description, price, partner_share, product_type, is_active, is_upgrade, sort_order)
VALUES ('Google Ads Boost', 'ads', 'Promote your press release with targeted Google Search Ads', 1500, 0, 'ads', true, true, 99);
```

---

## Files

| File | Purpose |
|------|---------|
| `packages/db/src/schema/advertising.ts` | Drizzle schema for `ad_campaigns` |
| `apps/dashboard/src/db/schema/advertising.ts` | Dashboard copy of schema |
| `apps/dashboard/src/services/google-ads.ts` | Google Ads API wrapper |
| `apps/dashboard/src/services/ad-copy-generator.ts` | AI ad copy generation |
| `apps/dashboard/src/app/api/pr/[uuid]/ads/route.ts` | Ad campaign CRUD API |
| `apps/dashboard/src/app/api/cron/ads/route.ts` | Monitoring cron endpoint |
| `apps/dashboard/src/app/api/editorial/review/route.ts` | Approval trigger (creates/launches campaigns) |
| `apps/dashboard/src/app/api/pr/[uuid]/distribution/route.ts` | Payment integration (creates campaign on purchase) |
| `apps/dashboard/src/components/ads/ad-campaign-card.tsx` | Dashboard UI component |

---

## Environment Variables

```
GOOGLE_ADS_CLIENT_ID=           # OAuth client ID from Google Cloud Console
GOOGLE_ADS_CLIENT_SECRET=       # OAuth client secret
GOOGLE_ADS_DEVELOPER_TOKEN=     # From Google Ads Manager Account API Center
GOOGLE_ADS_REFRESH_TOKEN=       # From one-time OAuth flow (long-lived)
GOOGLE_ADS_CUSTOMER_ID=         # Google Ads account ID (where ads run)
GOOGLE_ADS_LOGIN_CUSTOMER_ID=   # Manager Account (MCC) ID
CRON_SECRET=                    # Bearer token for cron endpoint auth
```

---

## Content Guidelines — What NOT to Advertise

All ads run under Newsworthy's Google Ads account. A policy violation on any single ad can trigger account-level review or suspension, affecting every campaign. Editors should decline ad boost for any release that falls into these categories.

### Hard No — Google Will Disapprove or Suspend

| Category | Examples | Google Policy |
|----------|----------|---------------|
| **Regulated substances** | Cannabis/CBD products, tobacco, vaping, kratom, nootropics marketed as drugs | Dangerous products or services |
| **Weapons & explosives** | Firearms, ammunition, fireworks, tactical gear | Dangerous products or services |
| **Adult content** | Anything sexually explicit or suggestive, adult entertainment, dating services with sexual content | Adult content |
| **Gambling & betting** | Online casinos, sports betting, fantasy sports with entry fees, lottery services | Gambling and games |
| **Healthcare claims** | Unapproved treatments, miracle cures, anti-aging claims, weight loss supplements with guarantees | Healthcare and medicines |
| **Financial products** | Crypto trading platforms, payday loans, penny stocks, binary options, get-rich-quick schemes | Financial products and services |
| **Counterfeit & IP** | Knockoff brands, replica goods, unauthorized use of trademarks | Counterfeit goods |
| **Hacking & surveillance** | Spyware, phone tracking tools, hacking services, exploit kits | Enabling dishonest behavior |
| **Political ads** | Election campaigns, ballot measures, political advocacy (requires Google verification we don't have) | Political content |
| **Bail bonds** | Bail bond services (banned in US) | Legal restrictions |

### Likely Disapproved — High Risk of Rejection

| Category | Why It's Risky |
|----------|----------------|
| **Legal services** | "Lawsuit" and "attorney" keywords trigger extra scrutiny; personal injury especially |
| **Addiction treatment** | Rehab centers require LegitScript certification with Google |
| **Cosmetic procedures** | Botox, fillers, plastic surgery — restricted in many regions |
| **Dietary supplements** | Health claims get flagged even if technically compliant |
| **Financial advisory** | Investment advice, tax planning — requires disclaimers Google checks for |
| **Real estate investment** | "Guaranteed returns" language common in PR copy triggers disapproval |
| **MLM / network marketing** | Multi-level marketing companies frequently flagged |
| **Funeral services** | Restricted category with extra review |

### Content That Causes Problems (Even If Technically Allowed)

| Issue | What Happens |
|-------|-------------|
| **Excessive capitalization** | "BREAKING NEWS" or "HUGE ANNOUNCEMENT" — ad disapproved for capitalization policy |
| **Exclamation marks in headlines** | Google disallows `!` in headlines (descriptions are fine) |
| **Misleading claims** | "World's best", "#1 rated", "guaranteed results" — disapproved for misleading content |
| **Clickbait language** | "You won't believe...", "This changes everything" — disapproved |
| **Price claims without proof** | "Save 90%", "Lowest price" — requires substantiation Google checks |
| **Trademarked terms in ad copy** | Using competitor names in headlines — trademark complaint risk |
| **Non-functional landing page** | If newsworthy.ai/news/... page is down or 404s, ad gets disapproved |

### Editor Checklist Before Approving Ad Boost

1. Is the PR about a product/service Google allows to advertise? (Check tables above)
2. Does the PR title avoid ALL CAPS, exclamation marks, and clickbait?
3. Are any claims in the PR verifiable and not misleading?
4. Is the company/product legitimate and not a known scam?
5. Will the landing page (article URL) be live when the ad starts serving?

**When in doubt, skip the ad boost.** The release still gets published — it just won't get a Google Ad campaign. Protecting the account is more important than any single campaign's revenue.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| AI copy generation fails | Falls back to template-based copy from PR title/abstract |
| Google disapproves the ad | Campaign marked `disapproved`, policy topics stored, visible on dashboard |
| Google Ads API error | Campaign marked `failed`, error stored in `policy_topics` |
| Release retracted after ad purchased | Campaign stays in `pending`, never launches |
| Editor changes budget after user purchased | Editor's amount overrides the original budget |
| Budget exhausted mid-campaign | Google stops serving; cron marks as `completed` |
| Multiple campaigns for same release | Prevented — system checks for existing campaign before creating |

---

## Cost Structure

| Item | Amount |
|------|--------|
| Customer price | $15 (configurable in products table) |
| Actual ad budget | ~$11 (price × 0.75) |
| Newsworthy margin | ~$4 (25%) |
| Editor-added spend | Any amount, no markup (Newsworthy absorbs cost) |
| Max CPC | $2.00 per click |
| Campaign duration | 30 days |
