import { db } from "@/db";
import { brandCredits } from "@/db/schema";
import { and, eq, isNull, or, gt, sql } from "drizzle-orm";

// Balance of unexpired credits for one (user, company-or-account, productType)
// scope. Must match how the DB-side enforce_brand_credit_nonnegative() trigger
// (drizzle/manual/2026-05-27-brand-credits-nonnegative.sql) computes the
// balance — per product_type, excluding expired rows — otherwise the app can
// pick a deduction scope the trigger will reject.
export async function creditBalance(
  userId: number,
  companyId: number | null,
  productType: string,
): Promise<number> {
  const result = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as(
        "balance",
      ),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        companyId === null
          ? isNull(brandCredits.companyId)
          : eq(brandCredits.companyId, companyId),
        eq(brandCredits.productType, productType),
        or(
          isNull(brandCredits.expiresAt),
          gt(brandCredits.expiresAt, new Date()),
        ),
      ),
    );
  return Number(result[0]?.balance || 0);
}

// Detect the Postgres trigger raising 23514 (check_violation) with the
// INSUFFICIENT_BRAND_CREDITS message. Drizzle may surface the pg error
// directly or wrapped as the `cause` of a DrizzleQueryError, so walk the
// cause chain.
export function isInsufficientCreditsDbError(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const e = current as { code?: string; message?: string; cause?: unknown };
    if (
      e.code === "23514" &&
      typeof e.message === "string" &&
      e.message.includes("INSUFFICIENT_BRAND_CREDITS")
    ) {
      return true;
    }
    current = e.cause;
  }
  return false;
}
