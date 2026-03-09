<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Newsworthy dashboard application. A singleton `posthog-node` client was added at `apps/dashboard/src/lib/posthog.ts`, and 14 events were instrumented across 11 server-side API route files covering the full user lifecycle: registration, authentication, company creation, the press release authoring pipeline, payments, and the editorial review workflow. User identification (`posthog.identify`) was added at all auth entry points to correlate server-side events with the correct user. Exception capture (`posthog.captureException`) was added to every error handler.

| Event | Description | File |
|---|---|---|
| `user_registered` | New user account created via email/password | `apps/dashboard/src/app/api/auth/register/route.ts` |
| `email_verified` | User verified email after registration | `apps/dashboard/src/app/api/auth/verify-email/route.ts` |
| `user_logged_in` | User authenticated via magic link | `apps/dashboard/src/app/api/auth/magic-link/route.ts` |
| `company_created` | User created a new company/brand profile | `apps/dashboard/src/app/api/company/route.ts` |
| `press_release_created` | User created a new press release draft (credit deducted) | `apps/dashboard/src/app/api/pr/route.ts` |
| `press_release_submitted` | User submitted a press release for editorial review | `apps/dashboard/src/app/api/pr/[uuid]/finalize/route.ts` |
| `press_release_deleted` | User deleted a draft press release and reclaimed credit | `apps/dashboard/src/app/api/pr/[uuid]/delete/route.ts` |
| `ai_draft_generated` | User generated an AI-written press release draft | `apps/dashboard/src/app/api/pr/generate-draft/route.ts` |
| `checkout_initiated` | User initiated a Stripe checkout session to purchase credits | `apps/dashboard/src/app/api/payment/checkout/route.ts` |
| `payment_completed` | Stripe webhook confirmed payment and credits granted | `apps/dashboard/src/app/api/payment/webhook/route.ts` |
| `guest_payment_completed` | Guest user completed payment via a shared payment link | `apps/dashboard/src/app/api/payment/webhook/route.ts` |
| `press_release_approved` | Editor approved a press release for distribution | `apps/dashboard/src/app/api/editorial/review/route.ts` |
| `press_release_rejected` | Editor rejected/returned a press release for revision | `apps/dashboard/src/app/api/editorial/review/route.ts` |
| `press_release_held` | Editor placed a press release on editorial hold | `apps/dashboard/src/app/api/editorial/review/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/336231/dashboard/1343256
- **User Signups & Email Verification**: https://us.posthog.com/project/336231/insights/NoFmf2ml
- **Press Release Funnel** (created → submitted → approved): https://us.posthog.com/project/336231/insights/E1IQtsN0
- **Payment Conversion** (checkout → completed): https://us.posthog.com/project/336231/insights/3xruXd4n
- **Editorial Review Outcomes** (approved / rejected / held): https://us.posthog.com/project/336231/insights/nwaEsRtD
- **AI Draft Generation vs PR Deletions**: https://us.posthog.com/project/336231/insights/iq0AsqJs

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/posthog-integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
