import { db } from '@/db'
import { brandCredits, products, releases } from '@/db/schema'
import { and, asc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'
import { creditBalance } from './brand-credits'
import { getBoolSetting, FREE_FIRST_PR_KEY } from './app-settings'
import { sendSmsNotification } from './twilio'

const DRAFT_STATUSES = ['draftnxt', 'draft', 'start']

export const STANDARD_DISTRIBUTION = 'standard'

// First-press-release-free offer (toggled at /admin/settings): while enabled,
// ANY registered user with zero PR credits and no press releases submits
// their first release free — the finalize route grants and consumes the
// credit in one step. Evaluated live, so flipping the toggle off ends the
// offer immediately for everyone who hasn't redeemed it.
export async function qualifiesForFreeFirstPr(userId: number): Promise<boolean> {
  if (!(await getBoolSetting(FREE_FIRST_PR_KEY, true))) return false

  // Zero credits: no positive pr/credits balance in any scope
  const [balanceRow] = await db
    .select({ balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)` })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        inArray(brandCredits.productType, ['pr', 'credits']),
        or(isNull(brandCredits.expiresAt), sql`${brandCredits.expiresAt} > now()`),
      ),
    )
  if (Number(balanceRow?.balance || 0) > 0) return false

  // No press releases: never charged for a submit (any product type) …
  const charged = await db
    .select({ id: brandCredits.id })
    .from(brandCredits)
    .where(and(eq(brandCredits.userId, userId), sql`${brandCredits.credits} < 0`))
    .limit(1)
  if (charged.length > 0) return false

  // … and owns no release that ever progressed beyond a draft
  const submitted = await db
    .select({ id: releases.id })
    .from(releases)
    .where(
      and(
        eq(releases.userId, userId),
        notInArray(releases.status, DRAFT_STATUSES),
        or(eq(releases.isDeleted, false), isNull(releases.isDeleted)),
      ),
    )
    .limit(1)
  return submitted.length === 0
}

// Scopes a manual release's submit-time deduction may charge, in priority
// order: brand-level before account-level, 'pr' before the legacy 'credits'
// product type. The finalize route locks and deducts in this same order.
export function prCreditScopes(companyId: number): [number | null, string][] {
  return [
    [companyId, 'pr'],
    [null, 'pr'],
    [companyId, 'credits'],
    [null, 'credits'],
  ]
}

// True when submitting this release will require buying a PR credit first:
// the release carries no deduction yet (not a legacy charge-at-creation draft
// or a resubmission) and no scope holds a positive pr/credits balance.
export async function releaseNeedsPrCredit(
  userId: number,
  release: { id: number; companyId: number },
): Promise<boolean> {
  const charged = await db
    .select({ id: brandCredits.id })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.prId, release.id),
        sql`${brandCredits.credits} < 0`,
        inArray(brandCredits.productType, ['pr', 'credits']),
      ),
    )
    .limit(1)
  if (charged.length > 0) return false

  for (const [companyId, productType] of prCreditScopes(release.companyId)) {
    if ((await creditBalance(userId, companyId, productType)) > 0) return false
  }

  // Covered by the first-release-free offer — nothing to buy
  if (await qualifiesForFreeFirstPr(userId)) return false

  return true
}

// The product sold in the finalize checkout when the user has no PR credit:
// the cheapest active single-credit 'pr' product visible to the user's
// partner, falling back to the cheapest 'pr' product of any size.
export async function getPrCreditProduct(partnerId: number | null) {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        eq(products.isDeleted, false),
        eq(products.productType, 'pr'),
        or(
          isNull(products.partnerId),
          partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId),
        ),
      ),
    )
    .orderBy(asc(products.price))

  return rows.find((p) => (p.productCredits ?? 1) === 1) || rows[0] || null
}

// Resolve a release's pending (selected-but-unpaid) upgrade types to their
// product rows, preserving selection order and dropping types that are no
// longer available.
export async function getPendingUpgradeProducts(
  release: { pendingUpgrades: string | null },
  partnerId: number | null,
) {
  const types = release.pendingUpgrades?.split(',').filter(Boolean) ?? []
  if (types.length === 0) return []

  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        eq(products.isDeleted, false),
        eq(products.isUpgrade, true),
        inArray(products.productType, types),
        or(
          isNull(products.partnerId),
          partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId),
        ),
      ),
    )

  return types
    .map((t) => rows.find((r) => r.productType === t))
    .filter((p): p is NonNullable<typeof p> => !!p)
}

// releases.distribution holds exactly one value, never a list: 'standard'
// (implied by yahoo and enhanced, and the default when neither applies), or
// the single distribution upgrade the release was bought. Yahoo and enhanced
// are mutually exclusive. Every other upgrade product — ads, concierge — is
// recorded against the release in brand_credits or ad_campaigns and must
// never be written to this column.
export const DISTRIBUTION_UPGRADES = ['yahoo', 'enhanced'] as const

export function isDistributionUpgrade(type: string): boolean {
  return (DISTRIBUTION_UPGRADES as readonly string[]).includes(type)
}

// The distribution upgrade among a set of purchased product types, if any.
export function pickDistributionUpgrade(types: string[]): string | null {
  return types.find(isDistributionUpgrade) ?? null
}

// Display name for the distribution upgrade applied to a release. Looked up
// without the active/partner filters used when selling — an upgrade that was
// paid for must still render after the product is retired — and falling back
// to the raw type so it never displays as nothing.
export async function getDistributionUpgradeName(
  distribution: string | null,
): Promise<string | null> {
  const type = distribution?.trim()
  if (!type || !isDistributionUpgrade(type)) return null

  const product = await db.query.products.findFirst({
    where: and(eq(products.isUpgrade, true), eq(products.productType, type)),
  })

  return product?.displayName || product?.shortName || type
}

// Text the site admins whenever a release gains an upgrade, however it was
// paid for. Best-effort — sendSmsNotification never throws.
export function notifyAdminsOfUpgrade(params: {
  upgradeNames: string[]
  releaseTitle: string | null
  customerName: string
  paidWith: 'card' | 'credit'
}): void {
  if (params.upgradeNames.length === 0) return

  const verb = params.paidWith === 'credit' ? 'redeemed with a credit' : 'purchased'
  sendSmsNotification(
    `Upgrade ${verb}: ${params.upgradeNames.join(', ')} by ${params.customerName} for "${
      params.releaseTitle || 'Untitled Press Release'
    }"`,
  )
}
