# Newsworthy.ai Unveils Next-Generation Platform Following Complete Technology Rebuild

**FOR IMMEDIATE RELEASE**

**Newsworthy.ai launches rebuilt platform with AI-native press release creation, real-time editorial workflows, and agent-to-agent protocol — delivering a faster, smarter experience for PR professionals and businesses.**

---

UNITED STATES — Newsworthy.ai, the press release distribution and PR management platform, today announced the launch of its next-generation platform following a complete technology rebuild. The platform has been re-engineered from the ground up, migrating from a legacy Python/Flask monolith to a modern Next.js architecture — delivering significant improvements in speed, reliability, and capability across every aspect of the product.

## AI-Native Press Release Creation

The most transformative addition is the platform's AI-powered authoring suite. Users can now generate complete press release drafts from a pasted URL or raw notes using GPT-4o, producing a structured release with headline, abstract, pull quote, body copy, and suggested categories in seconds. An integrated AI suggestions engine analyzes every release across three proprietary dimensions — SEO optimization, AI training value, and AI grounding quality — each scored on a 1-to-10 scale. Writers receive actionable headline alternatives tagged by strategy, brandable chunk analysis identifying weakly-branded sections, copy improvement suggestions with one-click accept, and automated FAQ generation for structured data SEO.

Users can also import content directly from Word documents or Google Docs URLs, with AI automatically formatting the content into press release structure.

## Redesigned Multi-Step Creation Wizard

The press release creation experience has been rebuilt as a guided multi-step wizard with a live side-by-side preview panel that snaps to desktop, tablet, and mobile viewport widths. The workflow walks users through writing, image management with drag-and-drop reordering and integrated Unsplash search, social banner design with text overlay editing, AI-generated FAQ sections, advocacy sharing, and distribution selection — all before a final review confirmation.

## Real-Time Editorial Workflow

The editorial system now operates as a fully integrated review pipeline within the dashboard. Editors check out releases with locking to prevent double-review, access a comprehensive review form with staff notes threading, score assignment, distribution tier overrides, and approve, return, or hold actions. A dedicated approved-pending queue tracks releases awaiting their scheduled publication date, while a separate interface allows post-publication editing of live releases. AI-assisted copy editing applies intelligent improvements with fuzzy text matching directly within the editorial flow.

## Full Payment and Credits System

The platform now features a complete Stripe-powered commerce layer. A pay-as-you-go credit system supports multiple distribution tiers — standard, Yahoo Finance, enhanced, and concierge — with credits tracked at both the user and brand level. Agency users can generate tokenized payment links for their clients, enabling payment without requiring a full account. The checkout flow includes cart management, abandoned cart tracking, subscription plan support with included PR counts, coupon codes, and partner commission structures. Transaction-level row locking prevents double-processing on concurrent webhook retries.

## Brand and Team Management

Brand profiles have been expanded into full organizational hubs. Each brand now supports team collaboration with role-based access controls and email invitations, shared image and banner libraries reusable across releases, media contact directories attached to releases, structured data and SEO metadata with AI-prefilled fields, and integrations with Google My Business, social platforms, and cloud storage services. Users can manage multiple brands from a single account, with credits allocated per brand.

## CRM and Media Outreach

A built-in CRM manages media contacts, advocates, and combined contact types with full social profile tracking, email engagement metrics, and import/export capabilities. Contacts organize into pitch groups and advocacy groups for targeted campaigns. The integrated NewsDB journalist database provides credit-gated lookups by name or publication, with query logging and editorial enrichment workflows for unfound contacts.

## Community Platform

A new community section provides discussion boards with rich text posts, image attachments, threaded comments with emoji reactions, user follows, direct messaging with read receipts, and admin-configurable boards with staff-only visibility options. Community guidelines require user acceptance before posting, with re-acceptance triggered on updates. The community is accessible from both the public website and the authenticated dashboard, with SSO-based routing directing logged-in users to the full-featured dashboard experience.

## Content Calendar with Google Calendar Sync

A planning calendar supports press release scheduling, social media planning, and event tracking with color-coded entries linked to brands and releases. One-way push sync to Google Calendar keeps external schedules current through OAuth-based integration.

## Agent-to-Agent AI Protocol

Newsworthy.ai has implemented a Google A2A-compatible agent API, enabling AI agents and LLM-powered tools to autonomously manage PR workflows. Public skills allow searching releases and brands, fetching full release content, and running AI analysis. Authenticated skills — secured with scoped API keys — enable agents to create and manage brands, draft and submit releases, and manage the full release lifecycle programmatically.

## Cross-Application SSO and Unified Experience

The platform now operates as two integrated applications — the public news wire at newsworthy.ai and the dashboard at app.newsworthyai.com — connected through HMAC-signed token-based single sign-on. Login state persists seamlessly across both applications, with the public site adapting its interface for authenticated users.

## Partner and White-Label Network

A partner infrastructure supports resellers and referring organizations with their own branding, custom pricing, commission structures, and dedicated management dashboards. Partner managers can track user counts, release volumes, and revenue across their network.

## Additional Platform Improvements

- **Kanban task boards** for personal and team workflow management with drag-and-drop, priority levels, file attachments, and notes
- **Messaging and inbox system** with direct messages, global announcements, release-linked messaging, and canned response templates
- **Slack and Google Chat integrations** for real-time notifications on editorial actions, task assignments, and status changes
- **Guided onboarding tours** with per-page walkthroughs targeting specific UI elements for new users
- **Full dark mode** across the entire dashboard
- **Influencer marketplace** connecting brands with content creators through an offer/counter-offer workflow with escrow fund tracking
- **Clip reports and analytics** with PDF generation, engagement dashboards, and feed impression tracking
- **Approval workflows** enabling external stakeholder sign-off on releases via secure, HMAC-signed URLs

## Built for Scale and Security

The rebuilt architecture delivers measurably faster page loads, type-safe database operations through Drizzle ORM, server-side rendering for SEO-critical pages, and enterprise-grade authentication supporting email/password, Google OAuth, LinkedIn OAuth, and magic link login. Existing users experienced zero disruption during the migration, with legacy password hashes verified transparently through a compatibility layer.

## Availability

The upgraded platform is live now at [app.newsworthyai.com](https://app.newsworthyai.com). New users can create a free account to explore the platform's capabilities.

---

**About Newsworthy.ai**

Newsworthy.ai is a press release distribution and PR management platform serving PR agencies, communications teams, and businesses. The platform combines a public news wire with an editorial-grade dashboard for creating, reviewing, distributing, and analyzing press releases. Learn more at [newsworthy.ai](https://www.newsworthy.ai).

**Media Contact:**
press@newsworthyai.com
