# Monorepo Migration Plan: nwai-sanity into newsworthy

## Overview

Merge `nwai-sanity` (public site at newsworthy.ai) into the `newsworthy` repo (authenticated dashboard) as a Turborepo monorepo. Migrate nwai-sanity from Prisma to Drizzle so both apps share a single ORM and schema.

**Current State:**
- `newsworthy` — Next.js 15 dashboard app, Drizzle ORM, Bun, 161 Drizzle tables
- `nwai-sanity` — Next.js 15 public site + Sanity CMS, Prisma ORM, ~100 Prisma models, ~42 Prisma query calls across 14 files

**End State:**
- Single monorepo with Turborepo
- `apps/dashboard/` — current newsworthy app
- `apps/website/` — current nwai-sanity app (migrated to Drizzle)
- `packages/db/` — shared Drizzle schema, client, and types
- `packages/config/` — shared TypeScript and Tailwind base configs

---

## Phase 0: Pre-Migration Prep

### 0.1 Snapshot & Safety
- [ ] Tag both repos: `git tag pre-monorepo-migration`
- [ ] Ensure both apps build and run cleanly
- [ ] Document all environment variables from both `.env` files
- [ ] Verify both apps point to the same PostgreSQL database

### 0.2 Audit Prisma ↔ Drizzle Table Overlap
- [ ] Compare 100 Prisma models against 161 Drizzle tables
- [ ] Identify tables that already exist in Drizzle (expected: most of them)
- [ ] Identify any Prisma models with NO Drizzle equivalent (need to add)
- [ ] Identify column name differences (Prisma uses snake_case DB names mapped to camelCase; Drizzle does the same — should be 1:1)

**Expected outcome:** ~90% of Prisma models already have Drizzle table definitions. A handful may need adding.

---

## Phase 1: Turborepo Scaffolding

### 1.1 Initialize Monorepo Structure
- [ ] Install Turborepo: `bun add -D turbo`
- [ ] Create root `turbo.json` with build/dev/lint pipelines
- [ ] Convert root `package.json` to workspaces:
  ```json
  { "workspaces": ["apps/*", "packages/*"] }
  ```

### 1.2 Move Dashboard App
- [ ] Move all current newsworthy files into `apps/dashboard/`
- [ ] Update `apps/dashboard/package.json` name to `@nwai/dashboard`
- [ ] Fix import paths (should be minimal since paths are relative/aliased)
- [ ] Verify `bun run dev` works from `apps/dashboard/`

### 1.3 Import Website App
- [ ] Copy nwai-sanity into `apps/website/`
- [ ] Alternatively, use `git subtree add` to preserve history:
  ```bash
  git subtree add --prefix=apps/website /path/to/nwai-sanity main --squash
  ```
- [ ] Update `apps/website/package.json` name to `@nwai/website`
- [ ] Verify `bun run dev` works from `apps/website/`

### 1.4 Shared Packages
- [ ] Create `packages/db/` — will hold shared Drizzle schema (Phase 2)
- [ ] Create `packages/config/` — shared tsconfig base, Tailwind preset (optional, can defer)

### 1.5 Root Configuration
- [ ] Root `package.json` with workspace scripts:
  ```json
  {
    "scripts": {
      "dev": "turbo dev",
      "build": "turbo build",
      "dev:dashboard": "turbo dev --filter=@nwai/dashboard",
      "dev:website": "turbo dev --filter=@nwai/website"
    }
  }
  ```
- [ ] Root `.env` strategy: each app keeps its own `.env.local`
- [ ] Root `.gitignore` updated for monorepo structure

---

## Phase 2: Extract Shared Database Package

### 2.1 Create packages/db
- [ ] Move `src/db/schema/` from dashboard to `packages/db/src/schema/`
- [ ] Move `src/db/index.ts` to `packages/db/src/index.ts`
- [ ] Move `drizzle.config.ts` to `packages/db/`
- [ ] Create `packages/db/package.json`:
  ```json
  {
    "name": "@nwai/db",
    "main": "./src/index.ts",
    "types": "./src/index.ts",
    "dependencies": {
      "drizzle-orm": "...",
      "postgres": "..."
    }
  }
  ```
- [ ] Export all tables and the `db` client from `packages/db`

### 2.2 Update Dashboard Imports
- [ ] Replace all `@/db` and `@/db/schema` imports with `@nwai/db`
- [ ] Add `@nwai/db` as a workspace dependency in `apps/dashboard/package.json`
- [ ] Verify dashboard builds

### 2.3 Add Missing Tables
- [ ] Cross-reference Prisma schema against Drizzle tables
- [ ] Add any missing table definitions to `packages/db/src/schema/`
- [ ] No database migrations needed — tables already exist in PostgreSQL

---

## Phase 3: Migrate nwai-sanity from Prisma to Drizzle

### 3.1 Swap Dependencies
- [ ] Add `@nwai/db` as workspace dependency in `apps/website/package.json`
- [ ] Remove `@prisma/client` and `prisma` from dependencies
- [ ] Remove `prisma/` directory
- [ ] Remove `prisma generate` from build script
- [ ] Update build script: `"build": "next build"` (no prisma generate)

### 3.2 Replace Prisma Client
- [ ] Delete `lib/prisma.ts` (Prisma singleton)
- [ ] Create `lib/db.ts` that re-exports from `@nwai/db`:
  ```ts
  export { db } from '@nwai/db'
  ```
- [ ] Review `lib/neon.ts` — if it duplicates Drizzle's connection, consolidate

### 3.3 Migrate Queries (14 files, ~42 calls)

**Priority order by query count:**

| # | File | Prisma Calls | Complexity |
|---|------|-------------|------------|
| 1 | `app/(news)/news/[id_string]/[slug]/page.tsx` | 9 | High — nested relations, translations |
| 2 | `lib/forms/actions/subscribe.ts` | 5 | Low — simple inserts/updates |
| 3 | `app/(news)/blockchain/txn-detail/[slug]/page.tsx` | 5 | Medium |
| 4 | `app/newsroom/[handle]/page.tsx` | 4 | Medium — company + releases |
| 5 | `lib/sms_send.ts` | 3 | Low — simple lookups |
| 6 | `app/(news)/news/fr/[id_string]/[slug]/page.tsx` | 3 | Same pattern as #1 |
| 7 | `app/(news)/news/es/[id_string]/[slug]/page.tsx` | 3 | Same pattern as #1 |
| 8 | `app/(news)/news/agency/[slug]/page.tsx` | 3 | Medium |
| 9 | `app/(site)/page.tsx` | 2 | Low — homepage queries |
| 10 | `app/(news)/news/beat/[slug]/page.tsx` | 2 | Low |
| 11 | `lib/prisma/category.ts` | 1 | Low — rewrite as Drizzle helper |
| 12 | `lib/prisma/press_releases.ts` | raw SQL | Medium — uses $queryRaw |
| 13 | `app/(news)/news/sponsored/page.tsx` | 1 | Low |
| 14 | `app/(feeds)/rss/latest.xml/route.ts` | 1 | Low |

### 3.4 Query Translation Patterns

**Prisma → Drizzle cheat sheet:**

```ts
// findFirst
// Prisma:
prisma.releases.findFirst({ where: { id: 1, is_deleted: false } })
// Drizzle:
db.query.releases.findFirst({ where: and(eq(releases.id, 1), eq(releases.isDeleted, false)) })

// findMany with select + orderBy
// Prisma:
prisma.releases.findMany({ select: { id: true, title: true }, orderBy: { createdAt: 'desc' }, take: 10 })
// Drizzle:
db.select({ id: releases.id, title: releases.title }).from(releases).orderBy(desc(releases.createdAt)).limit(10)

// Nested relations (Prisma include)
// Prisma:
prisma.releases.findFirst({ include: { company: true, translations: true } })
// Drizzle:
db.query.releases.findFirst({ where: ..., with: { company: true, translations: true } })

// Raw SQL
// Prisma:
prisma.$queryRaw`SELECT EXTRACT(MONTH FROM release_at) ...`
// Drizzle:
db.execute(sql`SELECT EXTRACT(MONTH FROM release_at) ...`)
```

### 3.5 Handle Special Cases
- [ ] **JSON fields** (`pdl`, `token`, `settings`): Use Drizzle's `json()` or `jsonb()` column type — already defined in existing schema
- [ ] **Raw SQL queries** in `lib/prisma/press_releases.ts`: Convert to Drizzle's `sql` template tag
- [ ] **Neon SDK** (`lib/neon.ts`): Evaluate if still needed or if Drizzle's postgres connection suffices

---

## Phase 4: Configuration Alignment

### 4.1 TypeScript
- [ ] Each app keeps its own `tsconfig.json`
- [ ] Both extend a shared base from `packages/config/tsconfig.base.json` (optional)
- [ ] Path aliases stay app-specific (`@/*` resolves within each app)
- [ ] Add path alias for `@nwai/db` in both tsconfigs

### 4.2 Tailwind
- [ ] Each app keeps its own `tailwind.config`
- [ ] Dashboard: current Tailwind config (unchanged)
- [ ] Website: current Tailwind config with styled-components coexistence
- [ ] Optional: extract shared color palette/theme to `packages/config/tailwind.preset.js`

### 4.3 Environment Variables
- [ ] Dashboard: `apps/dashboard/.env.local`
- [ ] Website: `apps/website/.env.local`
- [ ] Shared DB connection string: referenced in `packages/db` via `DATABASE_URL`
- [ ] Sanity-specific vars stay in website `.env.local`

### 4.4 Sanity CMS
- [ ] Sanity config stays in `apps/website/sanity.config.tsx`
- [ ] Sanity schemas stay in `apps/website/sanity/`
- [ ] No changes needed — Sanity is website-only

---

## Phase 5: Deployment

### 5.1 Vercel Configuration
- [ ] Two Vercel projects, each pointing to the same repo but different root directories
- [ ] Dashboard: Root Directory = `apps/dashboard`
- [ ] Website: Root Directory = `apps/website`
- [ ] Both use Turborepo's remote caching for faster builds
- [ ] Add `vercel.json` or configure via Vercel UI

### 5.2 Build Commands
- [ ] Dashboard: `cd ../.. && turbo build --filter=@nwai/dashboard`
- [ ] Website: `cd ../.. && turbo build --filter=@nwai/website`
- [ ] Or use Vercel's Turborepo integration (auto-detects)

### 5.3 Domain Routing
- [ ] Dashboard: stays on current authenticated domain
- [ ] Website: stays on newsworthy.ai
- [ ] No changes to DNS or domain config

---

## Phase 6: Verification & Cleanup

### 6.1 Testing
- [ ] Dashboard: full smoke test of all major flows (PR create/edit, community, CRM, etc.)
- [ ] Website: verify all 14 migrated files render correctly
  - [ ] News article pages (with translations)
  - [ ] Newsroom pages
  - [ ] Homepage
  - [ ] RSS feed
  - [ ] Blockchain verification pages
  - [ ] Sponsored content page
  - [ ] Beat/agency pages
  - [ ] Subscribe flow
  - [ ] SMS send flow
- [ ] Sanity Studio: verify `/admin` still works

### 6.2 Cleanup
- [ ] Remove `prisma/` directory from website app
- [ ] Remove all `@prisma/client` imports
- [ ] Delete `lib/prisma.ts` and `lib/prisma/` directory
- [ ] Archive the old standalone `nwai-sanity` repo (read-only)
- [ ] Update both CLAUDE.md files for monorepo structure

### 6.3 CI/CD
- [ ] GitHub Actions or equivalent builds both apps
- [ ] Turborepo caching enabled
- [ ] Lint/type-check both apps in CI

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prisma query produces different results than Drizzle equivalent | High | Test each migrated query against production data before deploying |
| Missing Drizzle table definitions for some Prisma models | Medium | Audit in Phase 0.2; add missing tables without running migrations |
| Turborepo slows down dev experience | Low | Each app can still run independently via `bun run dev` within its directory |
| Shared package changes break one app | Medium | Turborepo dependency graph ensures downstream apps rebuild |
| styled-components in website conflicts with shared Tailwind | Low | Keep separate — styled-components stays in website only |
| Sanity Studio breaks during restructure | Low | Sanity config is self-contained, just needs correct relative paths |

---

## Execution Order Summary

1. **Phase 0** — Audit, tag, document (1 day)
2. **Phase 1** — Turborepo scaffolding + move apps (1-2 days)
3. **Phase 2** — Extract shared DB package (1 day)
4. **Phase 3** — Prisma → Drizzle migration (2-3 days, bulk of work)
5. **Phase 4** — Config alignment (half day)
6. **Phase 5** — Deployment setup (half day)
7. **Phase 6** — Testing + cleanup (1-2 days)

**Total estimated effort: 6-9 days**

---

## Notes

- No database migrations are needed at any point. The PostgreSQL schema is unchanged — we're only swapping the ORM client.
- The Prisma migration is manageable because nwai-sanity only has ~42 actual Prisma calls across 14 files. The 100-model Prisma schema is large, but most tables already have Drizzle definitions.
- Both apps use Bun, React 19, Next.js 15, Tailwind, and shadcn — the stack alignment is excellent.
- The `neon.ts` direct SQL helper in nwai-sanity may become redundant once Drizzle is in place, since Drizzle supports raw SQL via `db.execute(sql\`...\`)`.
