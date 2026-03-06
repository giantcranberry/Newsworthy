# Public Read-Only Community Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public, read-only community section to the website app showing public posts and boards with CTAs to register.

**Architecture:** Server-rendered pages under `apps/website/app/(site)/community/` using the shared `@nwai/db` Drizzle package. No client components needed — everything is read-only HTML. A data access layer in `apps/website/lib/community.ts` encapsulates all DB queries.

**Tech Stack:** Next.js 15 RSC, Drizzle ORM via `@nwai/db`, Tailwind CSS, Lucide icons

**Security Note:** Post body content is stored as HTML from TinyMCE (already sanitized on the dashboard side at input time). The website renders it via `dangerouslySetInnerHTML` — this matches the existing pattern used throughout the dashboard (post-card.tsx, editorial forms, etc.) and the HTML is trusted content from authenticated users.

---

### Task 1: Create community data access layer

**Files:**
- Create: `apps/website/lib/community.ts`

**Step 1: Create the data access file**

This file provides all DB queries for the public community. It imports from `@/lib/db` (which re-exports `@nwai/db`). All queries filter `visibility = 'public'` and `isDeleted = false`.

```ts
import { db } from '@/lib/db'
import { communityBoards, communityPosts, communityPostImages } from '@nwai/db'
import { users, userProfiles } from '@nwai/db'
import { eq, and, desc, asc, count, sql, lt } from 'drizzle-orm'

export async function getBoards() {
  return db
    .select({
      id: communityBoards.id,
      name: communityBoards.name,
      slug: communityBoards.slug,
      description: communityBoards.description,
      iconClass: communityBoards.iconClass,
      color: communityBoards.color,
      postCount: count(communityPosts.id),
    })
    .from(communityBoards)
    .leftJoin(
      communityPosts,
      and(
        eq(communityPosts.boardId, communityBoards.id),
        eq(communityPosts.isDeleted, false),
        eq(communityPosts.visibility, 'public')
      )
    )
    .where(
      and(
        eq(communityBoards.isDeleted, false),
        eq(communityBoards.isArchived, false)
      )
    )
    .groupBy(communityBoards.id)
    .orderBy(asc(communityBoards.sortOrder))
}

export async function getBoardBySlug(slug: string) {
  const [board] = await db
    .select()
    .from(communityBoards)
    .where(
      and(
        eq(communityBoards.slug, slug),
        eq(communityBoards.isDeleted, false),
        eq(communityBoards.isArchived, false)
      )
    )
    .limit(1)
  return board ?? null
}

export async function getPublicPosts(options: {
  boardId?: number
  limit?: number
  before?: string
} = {}) {
  const { boardId, limit = 20, before } = options

  const conditions = [
    eq(communityPosts.isDeleted, false),
    eq(communityPosts.visibility, 'public'),
  ]
  if (boardId) conditions.push(eq(communityPosts.boardId, boardId))
  if (before) conditions.push(lt(communityPosts.createdAt, new Date(before)))

  const posts = await db
    .select({
      id: communityPosts.id,
      uuid: communityPosts.uuid,
      body: communityPosts.body,
      isPinned: communityPosts.isPinned,
      commentCount: communityPosts.commentCount,
      reactionCount: communityPosts.reactionCount,
      createdAt: communityPosts.createdAt,
      boardName: communityBoards.name,
      boardSlug: communityBoards.slug,
      boardColor: communityBoards.color,
      userName: sql<string>`coalesce(${userProfiles.acctName}, ${userProfiles.firstName} || ' ' || ${userProfiles.lastName}, 'Community Member')`,
      userAvatar: userProfiles.avatar,
    })
    .from(communityPosts)
    .innerJoin(communityBoards, eq(communityPosts.boardId, communityBoards.id))
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.id))
    .where(and(...conditions))
    .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
    .limit(limit)

  // Fetch images for all posts
  const postIds = posts.map(p => p.id)
  const images = postIds.length > 0
    ? await db
        .select()
        .from(communityPostImages)
        .where(sql`${communityPostImages.postId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(asc(communityPostImages.sortOrder))
    : []

  return posts.map(post => ({
    ...post,
    images: images.filter(img => img.postId === post.id),
  }))
}

export async function getPostByUuid(uuid: string) {
  const [post] = await db
    .select({
      id: communityPosts.id,
      uuid: communityPosts.uuid,
      body: communityPosts.body,
      isPinned: communityPosts.isPinned,
      visibility: communityPosts.visibility,
      commentCount: communityPosts.commentCount,
      reactionCount: communityPosts.reactionCount,
      createdAt: communityPosts.createdAt,
      boardName: communityBoards.name,
      boardSlug: communityBoards.slug,
      boardColor: communityBoards.color,
      boardDescription: communityBoards.description,
      userName: sql<string>`coalesce(${userProfiles.acctName}, ${userProfiles.firstName} || ' ' || ${userProfiles.lastName}, 'Community Member')`,
      userAvatar: userProfiles.avatar,
      userBio: userProfiles.bio,
    })
    .from(communityPosts)
    .innerJoin(communityBoards, eq(communityPosts.boardId, communityBoards.id))
    .innerJoin(users, eq(communityPosts.userId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.id))
    .where(
      and(
        eq(communityPosts.uuid, uuid),
        eq(communityPosts.isDeleted, false),
        eq(communityPosts.visibility, 'public')
      )
    )
    .limit(1)

  if (!post) return null

  const images = await db
    .select()
    .from(communityPostImages)
    .where(eq(communityPostImages.postId, post.id))
    .orderBy(asc(communityPostImages.sortOrder))

  return { ...post, images }
}
```

**Step 2: Verify it compiles**

Run: `cd /home/david/Dev/nextjs/newsworthy && bunx tsc --noEmit --project apps/website/tsconfig.json 2>&1 | head -20`

Fix any type errors before proceeding.

**Step 3: Commit**

```bash
git add apps/website/lib/community.ts
git commit -m "feat(website): add community data access layer"
```

---

### Task 2: Create shared community components

**Files:**
- Create: `apps/website/components/community/board-card.tsx`
- Create: `apps/website/components/community/public-post-card.tsx`
- Create: `apps/website/components/community/post-images.tsx`
- Create: `apps/website/components/community/register-cta.tsx`
- Create: `apps/website/components/community/register-banner.tsx`

**Step 1: Create BoardCard component**

`apps/website/components/community/board-card.tsx` — server component, link card showing board name, icon (Font Awesome via iconClass), color, description, and public post count.

**Step 2: Create PostImages** — same pattern as dashboard (`apps/dashboard/src/components/community/post-images.tsx`) but without `'use client'` or dark mode classes.

**Step 3: Create PublicPostCard** — read-only version of dashboard post-card. Shows avatar/initials, author name, board tag with color, time ago, body (HTML via `dangerouslySetInnerHTML` — trusted content from authenticated TinyMCE input), images, reaction/comment counts, and "Read more" link. No edit/delete/pin controls.

**Step 4: Create RegisterCTA** — dashed border card with UserPlus icon, configurable action text, and link to `https://newsworthy.ai/auth/register`.

**Step 5: Create RegisterBanner** — `'use client'` component. Fixed bottom bar with dismiss button (X), CTA text, and "Sign up free" link. Uses `useState` for dismiss.

**Step 6: Commit**

```bash
git add apps/website/components/community/
git commit -m "feat(website): add public community components"
```

---

### Task 3: Create community hub page (`/community`)

**Files:**
- Create: `apps/website/app/(site)/community/page.tsx`

**Step 1: Create the hub page**

Server component with `revalidate = 120`. Metadata with title "Community" and OG tags. Renders:
1. Centered heading with description
2. Boards grid (1/2/3 columns responsive)
3. RegisterCTA (action="start a discussion")
4. Recent public posts feed (limit 20)
5. RegisterBanner at bottom

**Step 2: Test it renders**

Run: `cd /home/david/Dev/nextjs/newsworthy && bun run dev --filter=@nwai/website`
Visit: http://127.0.0.1:3000/community

**Step 3: Commit**

```bash
git add apps/website/app/\(site\)/community/page.tsx
git commit -m "feat(website): add public community hub page"
```

---

### Task 4: Create board detail page (`/community/board/[slug]`)

**Files:**
- Create: `apps/website/app/(site)/community/board/[slug]/page.tsx`

**Step 1: Create the board page**

Server component with dynamic metadata from board name. Back link to /community. Board header with icon, color, name, description, rules. RegisterCTA. Posts filtered to board (showBoard=false). RegisterBanner.

Uses `generateMetadata` with `params: Promise<{ slug: string }>` (Next.js 15 async params pattern). Returns `notFound()` if slug doesn't match.

**Step 2: Test**

Visit: http://127.0.0.1:3000/community/board/{any-board-slug}

**Step 3: Commit**

```bash
git add apps/website/app/\(site\)/community/board/
git commit -m "feat(website): add public community board page"
```

---

### Task 5: Create post detail page (`/community/post/[uuid]`)

**Files:**
- Create: `apps/website/app/(site)/community/post/[uuid]/page.tsx`

**Step 1: Create the post detail page**

Server component. Dynamic metadata with author name + board name as title, truncated plain text body as description. DiscussionForumPosting schema.org structured data (JSON-LD). Back link to board. Author header with avatar. Full post body (prose prose-lg). PostImages. Reaction/comment counts. RegisterCTA (action="comment on this post"). RegisterBanner.

**Step 2: Test**

Visit: http://127.0.0.1:3000/community/post/{any-public-post-uuid}

**Step 3: Commit**

```bash
git add apps/website/app/\(site\)/community/post/
git commit -m "feat(website): add public community post detail page"
```

---

### Task 6: Add community link to website navbar

**Files:**
- Modify: `apps/website/components/navbar.tsx`

**Step 1: Add Community link to nav items**

Find the existing nav items (About Us, Solutions, Top Categories, Blog, Pricing) and add "Community" as a direct link (not dropdown) pointing to `/community`. Match existing nav item styling.

**Step 2: Test navigation**

Visit http://127.0.0.1:3000, confirm "Community" appears in both desktop and mobile nav.

**Step 3: Commit**

```bash
git add apps/website/components/navbar.tsx
git commit -m "feat(website): add community link to navbar"
```

---

### Task 7: Verify all pages and do final review

**Step 1: Test all routes**

- http://127.0.0.1:3000/community — hub with boards + posts
- http://127.0.0.1:3000/community/board/{slug} — board-specific posts
- http://127.0.0.1:3000/community/post/{uuid} — post detail with images
- Confirm 404 for invalid slugs/uuids
- Confirm only public posts appear (no team/followers posts)
- Confirm no comments displayed
- Confirm CTAs link to registration
- Confirm sticky banner dismisses on X click
- Check page source for meta tags and structured data

**Step 2: Final commit if any fixes needed**

```bash
git add -p
git commit -m "fix(website): community page polish"
```
