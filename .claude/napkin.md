# Napkin

## Corrections
| Date | Source | What Went Wrong | What To Do Instead |
|------|--------|----------------|-------------------|
| 2026-02-12 | self | Used `variant="destructive"` on Button but `--destructive` CSS var is not defined in globals.css | Use explicit Tailwind colors (e.g. `bg-red-600 text-white`) instead of shadcn semantic color variants. globals.css only defines `--background` and `--foreground`. |

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

## Patterns That Don't Work
- (accumulate as sessions progress)

## Domain Notes
- Next.js 16.1.3 with Turbopack
- Project: newsworthy (press release platform)
- turbopack.root set to __dirname in next.config.ts to avoid parent dir lockfile conflicts
