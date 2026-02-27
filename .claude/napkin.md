# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-12 | self | Used `variant="destructive"` on Button but `--destructive` CSS var is not defined in globals.css | Use explicit Tailwind colors (e.g. `bg-red-600 text-white`) instead of shadcn semantic color variants. globals.css only defines `--background` and `--foreground`. |
| 2026-02-24 | self | Imported shadcn Select subcomponents (SelectContent, SelectItem, etc.) but this project uses a plain native `<select>` wrapper | Check `src/components/ui/select.tsx` — it only exports `Select` (a styled native `<select>`). Use `<option>` elements, not shadcn sub-components. |
| 2026-02-27 | self | Used `Select` import for Radix select in manage-credits — `Select` is the native HTML select wrapper, not the Radix one | Use `SelectRoot` for Radix-based selects (with `onValueChange`, `SelectTrigger`, `SelectContent`, `SelectItem`). `Select` is the native `<select>` wrapper. |
| 2026-02-27 | self | Used `rgba()` CSS color strings in react-pdf SVG `fill` attributes — colors rendered as garbled yellow/red | Use SVG `fillOpacity` attribute instead: `fill={color} fillOpacity={0.15}`. react-pdf doesn't parse `rgba()` in SVG fill correctly. |

## User Preferences
- Use bun, not npm/yarn/node
- Use shadcn components, not Radix primitives
- Use tailwind CSS and tailwind typography
- Use 127.0.0.1 instead of localhost for DB strings
- Never run DB migrations automatically; show them for review
- Never drop tables or databases

## Patterns That Work
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
- Don't do fallback fulfillment on the thanks page — only the webhook should create brand_credits entries. Double-logging happens when both paths run.
- Don't check `if (product.productCredits)` — 0 is falsy. Use `product.productCredits || 1` to default to 1 for products with 0 credits.
- `chartjs-node-canvas` uses native canvas bindings incompatible with Next.js/Turbopack bundler (MODULE_NOT_FOUND). Use react-pdf's built-in SVG primitives (Svg, Path, Rect, Circle, G, Line) to draw charts natively in PDFs instead.
- `@react-pdf/renderer` rejects image URLs without recognized extensions (.png, .jpg, .gif, etc.) and SVG URLs. Always validate with `isValidPdfImageUrl()` before passing to `<Image>` and fall back to text.
- react-pdf `rgba()` in SVG fill attrs renders wrong colors. Use `fill={hexColor} fillOpacity={0.15}` instead.
- react-pdf `wrap={false}` on large sections (many clips/logos) causes headers to strand on previous page while content jumps to next. Fix: allow wrapping on the outer section, use `wrap={false}` only on the header/tab row so it stays together, let the grid content flow naturally across pages.
- PDF report file: `src/app/api/pr/[uuid]/report/pdf/report-pdf.tsx`. Web report: `src/app/(dashboard)/pr/clips/[uuid]/clips-report.tsx`. Data service: `src/services/report.ts`. Still has remaining page-break issues to revisit.

## Domain Notes
- Next.js 16.1.3 with Turbopack
- Project: newsworthy (press release platform)
- turbopack.root set to __dirname in next.config.ts to avoid parent dir lockfile conflicts
- Flask app at ~/Dev/flaskapps/newsworthy is the legacy version; editorial routes in news/editorial/routes.py
- Both Flask and Next.js use status='review' for editorial queue. 'editorial' is NOT a valid status — it was a ghost reference that has been cleaned up.
- Flask editorial queue orders by release_at asc, shows distribution badges (yahoo/enhanced/standard)
- Flask approval sets score (2-5), distribution (standard/yahoo/enhanced), feature flag, creates ReleaseEnhanced record
- Flask 'hold' action sets status='hold' (distinct from 'reject' which goes to 'draft')
- Explore agents cannot access directories outside the project root; use Bash for cross-repo file reads
