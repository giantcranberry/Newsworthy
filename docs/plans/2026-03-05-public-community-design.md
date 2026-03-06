# Public Read-Only Community on Website

## Overview

Add a public, read-only version of the dashboard community to the website at `/community`. Shows only public posts (no comments). Visitors are prompted to register a free account at newsworthy.ai to participate.

## Pages & URLs

| URL | Page | Description |
|-----|------|-------------|
| `/community` | Hub | Board grid + recent public posts feed |
| `/community/board/[slug]` | Board feed | Public posts filtered to one board |
| `/community/post/[uuid]` | Post detail | Single post body + images (no comments) |

All pages are server-rendered (RSC) for SEO.

## Data Access

Uses existing `lib/db.ts` -> `@nwai/db` Drizzle connection. Queries filter:

- `communityPosts.visibility = 'public'`
- `communityPosts.isDeleted = false`
- `communityBoards.isDeleted = false` and `communityBoards.isArchived = false`
- Joins `users` for author display name/avatar
- Joins `communityBoards` for board info

## Layout

Pages live under `apps/website/app/(site)/community/` inheriting the existing site layout (NavBar + Footer).

## Components (`apps/website/components/community/`)

- **BoardCard** - Clickable card with board name, color, description, post count
- **PublicPostCard** - Post body (rendered HTML), author name/avatar, board tag, timestamp, image thumbnails
- **PostImages** - Image gallery for post detail page
- **RegisterCTA** - Reusable inline CTA block ("Join the conversation")
- **RegisterBanner** - Sticky bottom banner with register CTA

## CTA Placement

- Sticky bottom banner on all community pages
- Inline CTAs where action buttons would be ("Sign up to post", "Sign up to comment")
- All CTAs link to newsworthy.ai registration

## SEO

- Proper `<title>`, `<meta description>`, Open Graph tags per page
- Board pages: "Community - {Board Name} | Newsworthy.ai"
- Post pages: truncated post body as description
- DiscussionForumPosting schema.org structured data on post detail pages

## Not Included

- No comments displayed
- No reactions/follow/chat
- No authentication or write operations
