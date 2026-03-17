# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-12 | self | Used `variant="destructive"` on Button but `--destructive` CSS var is not defined in globals.css | Use explicit Tailwind colors (e.g. `bg-red-600 text-white`) instead of shadcn semantic color variants. globals.css only defines `--background` and `--foreground`. |
| 2026-02-24 | self | Imported shadcn Select subcomponents (SelectContent, SelectItem, etc.) but this project uses a plain native `<select>` wrapper | Check `src/components/ui/select.tsx` — it only exports `Select` (a styled native `<select>`). Use `<option>` elements, not shadcn sub-components. |
| 2026-02-27 | self | Used `Select` import for Radix select in manage-credits — `Select` is the native HTML select wrapper, not the Radix one | Use `SelectRoot` for Radix-based selects (with `onValueChange`, `SelectTrigger`, `SelectContent`, `SelectItem`). `Select` is the native `<select>` wrapper. |
| 2026-02-27 | self | Used `rgba()` CSS color strings in react-pdf SVG `fill` attributes — colors rendered as garbled yellow/red | Use SVG `fillOpacity` attribute instead: `fill={color} fillOpacity={0.15}`. react-pdf doesn't parse `rgba()` in SVG fill correctly. |
| 2026-02-27 | user | Banner upload: kept trying server-side sharp processing instead of using client-side react-easy-crop. User said "use react-easy-crop" 3x. | Image processing belongs on the client. Use `Cropper` from `react-easy-crop` directly (not the ImageCropper wrapper). Server just normalizes to JPEG. User prefers "Fit with Background" as default mode. |
| 2026-03-01 | self | Only filtered `is_deleted` on company queries, but brands with `is_archived=true` still showed in dropdowns | Always filter BOTH `is_deleted` AND `is_archived` when fetching active companies. Same for contacts. `isArchived` is nullable so use `or(eq(isArchived, false), isNull(isArchived))`. |
| 2026-03-14 | user | Created new `courtesy_codes` + `courtesy_code_redemptions` tables when existing `coupons` + `coupon_log` tables already exist in partners.ts schema (and in Flask) | Always check existing schema/Flask models before creating new tables. Coupon system: `coupons` (coupon_code, pr_count, single_use, is_used, redeemed counter, expires_at) + `coupon_log` (user_id, coupon_code) in `db/schema/partners.ts`. |
| 2026-03-15 | user | Used FilestackPicker for product logo upload — Filestack is deprecated in this project | All image uploads use Linode Object Storage via `@/services/s3.ts`. Pattern: `ImageUpload` component → FormData POST to a dedicated `/logo` API route → `s3.ts` upload function (sharp resize + S3 PutObject). Never use FilestackPicker. |
| 2026-03-15 | self | Schema exists in BOTH `packages/db/src/schema/` and `apps/dashboard/src/db/schema/` — must update both when adding columns | Dashboard has its own copy of schema files that re-export from the shared package. Adding a column to only one location causes type mismatches. Always update both. |
| 2026-03-17 | self | Tried modifying website API route but `baseUrl` is hardcoded to `https://www.newsworthy.ai` — local API changes had no effect | Website's `baseUrl` in `lib/utils.ts` points to production. Server component fetch calls hit production API, not local. For data enrichment, do it directly in the server component page, not in the API route. |
| 2026-03-17 | self | Used `grid-flow-col` for search results layout — columns auto-sized causing variable text indentation | Use explicit `grid-cols-[235px_1fr]` instead of `grid-flow-col` when you need fixed column widths in a grid layout. |
| 2026-03-15 | self | `is_deleted` is `null` (not `false`) on many products rows — `eq(isDeleted, false)` misses them | Always use `or(eq(field, false), isNull(field))` for nullable boolean columns like `is_deleted`. Same pattern as `is_archived`. |

## User Preferences
- Use bun, not npm/yarn/node
- Use shadcn components, not Radix primitives
- Use tailwind CSS and tailwind typography
- Use 127.0.0.1 instead of localhost for DB strings
- Never run DB migrations automatically; show them for review
- Never drop tables or databases

## Patterns That Work
- DnD between columns (Kanban): use `DragOverlay` for visual drag preview, `handleDragOver` for cross-column movement, `handleDragEnd` for persistence. `PointerSensor` with `activationConstraint: { distance: 5 }` prevents accidental drags when clicking cards.
- Native `<Select>` (`Select` component) for simple dropdowns with `<option>` elements. `SelectRoot` for Radix-based selects.
- NextAuth v5 (Auth.js) uses `__Secure-` cookie prefix in production (HTTPS). Cookie name must be `__Secure-authjs.session-token` and `salt` in `encode()` must match. In dev it's just `authjs.session-token`.
- For read-only forms: use `<fieldset disabled={readOnly}>` to natively disable all inputs without touching each one. Hide action buttons (save, delete, add) with `{!readOnly && ...}`. For list components, hide checkboxes and edit/delete action columns.
- Stripe clients must be lazily initialized (inside a function, not at module scope) to avoid build errors when env vars are missing during static page collection
- Credit balance checks should use net balance (SUM of all credits including negative deductions) not filter by `prId IS NULL`
- Flex children that contain truncated text or nested flex layouts need `min-w-0` to prevent overflow — especially inside cards with `overflow-hidden` which silently clips content
- Admin CRUD pattern: server page.tsx fetches data → client list component → client form in Dialog → API routes at /api/admin/{resource}/
- Auth: NextAuth v5 signIn callback auto-creates users for OAuth providers (Google/LinkedIn). JWT strategy. Werkzeug + bcrypt password support.
- Email verification uses `verify` table with UUID tokens. Magic link pattern reused for verify-email.
- Payment flow: paygo page → `/api/payment/cart` (creates `carts` rows) → `/payment/cart` (review + Stripe Payment Element) → `/payment/thanks`
- Stripe env vars: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_SANDBOX`; sandbox detection via `window.location.host`
- `userProfiles.stripe` stores Stripe customer ID. `carts` table uses one row per product linked by `cartUuid`.
- Credits stored in `brand_credits` table (not `user_subscription`). `payfile` for receipt tracking.

## Patterns That Don't Work
- **TinyMCE + React state on every keystroke causes cursor jumping.** Never use `value` (controlled mode) or `onEditorChange` that stores full HTML in state — each `setState` triggers a re-render that fights TinyMCE's internal cursor management. Instead: use `initialValue` (uncontrolled), `onInit` to store `editorRef`, read content from `editorRef.current.getContent()` at submit time. If you need a disabled button, track a `hasContent` boolean (only re-renders when empty↔non-empty flips). Files already fixed: post-form.tsx, post-card.tsx, task-form.tsx. Files already correct (use ref pattern): pr-form.tsx, editorial-edit-form.tsx, newsroom-form.tsx, product-form.tsx, global-message-form.tsx, send-message-form.tsx.
- Don't do fallback fulfillment on the thanks page — only the webhook should create brand_credits entries. Double-logging happens when both paths run.
- Don't check `if (product.productCredits)` — 0 is falsy. Use `product.productCredits || 1` to default to 1 for products with 0 credits.
- `chartjs-node-canvas` uses native canvas bindings incompatible with Next.js/Turbopack bundler (MODULE_NOT_FOUND). Use react-pdf's built-in SVG primitives (Svg, Path, Rect, Circle, G, Line) to draw charts natively in PDFs instead.
- `@react-pdf/renderer` rejects SVG and WebP images — only PNG, JPEG, GIF, BMP, TIFF work. Use `isValidPdfImageUrl()` to validate and fall back to text. Dynamic image URLs without file extensions (like QR code APIs) can work if they serve PNG/JPEG — skip the extension check for those.
- react-pdf `rgba()` in SVG fill attrs renders wrong colors. Use `fill={hexColor} fillOpacity={0.15}` instead.
- react-pdf `wrap={false}` on large sections (many clips/logos) causes headers to strand on previous page while content jumps to next. Fix: allow wrapping on the outer section, use `wrap={false}` only on the header/tab row so it stays together, let the grid content flow naturally across pages.
- PDF report file: `src/app/api/pr/[uuid]/report/pdf/report-pdf.tsx`. Web report: `src/app/(dashboard)/pr/clips/[uuid]/clips-report.tsx`. Data service: `src/services/report.ts`. Still has remaining page-break issues to revisit.

## Patterns That Work (continued)
- Community feature: community schema in `/src/db/schema/community.ts`, all tables use snake_case DB columns with camelCase JS fields
- Large feature implementation: create schema first, then API routes, then pages/components. TypeScript catches integration issues early.
- Chat polling pattern: active conversation polls every 5s, conversation list every 30s, header badge every 60s
- Visibility filtering for posts: use separate queries for followed user IDs and company member IDs, then build OR condition

## Domain Notes
- **Monorepo**: Turborepo with `apps/dashboard` (Next.js 16.1.3 Turbopack, port 3001), `apps/website` (Next.js 15.5, port 3000), `packages/db` (shared Drizzle schema)
- Dashboard: `@nwai/dashboard`, Website: `@nwai/website`, DB: `@nwai/db`
- Website uses `@/` paths mapped to `./` (not `./src/`). Dashboard uses `@/` mapped to `./src/`
- `turbopack.root` and `experimental.outputFileTracingRoot` both set to `path.resolve(__dirname, "../..")` in both apps
- Website's `next.config.js` needs `experimental.serverActions: true` and `serverComponentsExternalPackages: ['cheerio', 'undici']` — cheerio's undici dep has private class fields that webpack can't parse
- Dashboard uses Zod 4 (`^4.3.5`), website uses Zod 3.25 compat layer (`^3.25.0`). Both resolve to 3.25.76 for website — this is required so `@hookform/resolvers` types align
- Always run builds via `bun run build:website` / `bun run build:dashboard` from monorepo root — parent `~/Dev/nextjs/node_modules/` has stale Next.js 13 that `npx` picks up
- Website `baseUrl` (`lib/utils.ts`) = `https://www.newsworthy.ai` (production). Server component fetches hit production API, not local dev. Do data enrichment in the server component directly.
- Images migrated from Filestack to Linode Object Storage at `cdn.newsramp.app`. Banner URLs in `banners.url` column. ElasticSearch `og_image` field still has stale Filestack URLs — must be overridden from DB.
- `lib/neon.ts` uses raw `pg` Pool for separate newsramp articles DB (NEON_DIRECT_URL) — NOT part of Drizzle schema
- Flask app at ~/Dev/flaskapps/newsworthy is the legacy version; editorial routes in news/editorial/routes.py
- Both Flask and Next.js use status='review' for editorial queue. 'editorial' is NOT a valid status — it was a ghost reference that has been cleaned up.
- Flask editorial queue orders by release_at asc, shows distribution badges (yahoo/enhanced/standard)
- Flask approval sets score (2-5), distribution (standard/yahoo/enhanced), feature flag, creates ReleaseEnhanced record
- Flask 'hold' action sets status='hold' (distinct from 'reject' which goes to 'draft')
- Explore agents cannot access directories outside the project root; use Bash for cross-repo file reads
