# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-12 | self | Used `variant="destructive"` on Button but `--destructive` CSS var is not defined in globals.css | Use explicit Tailwind colors (e.g. `bg-red-600 text-white`) instead of shadcn semantic color variants. globals.css only defines `--background` and `--foreground`. |
| 2026-02-24 | self | Imported shadcn Select subcomponents (SelectContent, SelectItem, etc.) but this project uses a plain native `<select>` wrapper | Check `src/components/ui/select.tsx` — it only exports `Select` (a styled native `<select>`). Use `<option>` elements, not shadcn sub-components. |

## User Preferences
- Use bun, not npm/yarn/node
- Use shadcn components, not Radix primitives
- Use tailwind CSS and tailwind typography
- Use 127.0.0.1 instead of localhost for DB strings
- Never run DB migrations automatically; show them for review
- Never drop tables or databases

## Patterns That Work
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

## Domain Notes
- Next.js 16.1.3 with Turbopack
- Project: newsworthy (press release platform)
- turbopack.root set to __dirname in next.config.ts to avoid parent dir lockfile conflicts
