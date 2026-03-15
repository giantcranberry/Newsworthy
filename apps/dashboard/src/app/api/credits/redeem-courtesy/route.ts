import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { brandCredits, coupons, couponLog } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export async function GET() {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  const existing = await db
    .select({ id: couponLog.id })
    .from(couponLog)
    .where(eq(couponLog.userId, userId))
    .limit(1)

  return NextResponse.json({ hasRedeemed: existing.length > 0 })
}

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const { code } = body as { code: string }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({ error: 'Please enter a code' }, { status: 400 })
    }

    // Normalize: lowercase, replace = with - (matching Flask logic)
    const normalizedCode = code.trim().toLowerCase().replace(/=/g, '-')

    const result = await db.transaction(async (tx) => {
      // Find the coupon
      const [coupon] = await tx
        .select()
        .from(coupons)
        .where(and(
          eq(coupons.couponCode, normalizedCode),
          eq(coupons.isDeleted, false),
        ))
        .for('update')

      if (!coupon) {
        return { error: 'Invalid code', status: 400 }
      }

      // Check expiry
      if (coupon.expiresAt && new Date() > coupon.expiresAt) {
        return { error: 'This code has expired', status: 400 }
      }

      // Check single-use: if single_use and already used
      if (coupon.singleUse && coupon.isUsed) {
        return { error: 'This code has already been used', status: 400 }
      }

      // Check if this user already redeemed this specific code
      const [existing] = await tx
        .select({ id: couponLog.id })
        .from(couponLog)
        .where(and(
          eq(couponLog.userId, userId),
          eq(couponLog.couponCode, normalizedCode),
        ))
        .limit(1)

      if (existing) {
        return { error: 'You have already redeemed this code', status: 400 }
      }

      // Increment redeemed counter, mark as used if single-use
      await tx
        .update(coupons)
        .set({
          redeemed: sql`${coupons.redeemed} + 1`,
          ...(coupon.singleUse ? { isUsed: true } : {}),
        })
        .where(eq(coupons.id, coupon.id))

      // Log the redemption
      await tx.insert(couponLog).values({
        userId,
        couponCode: normalizedCode,
        createdAt: new Date(),
      })

      // Insert credit(s) — pr_count from the coupon
      await tx.insert(brandCredits).values({
        userId,
        companyId: null,
        credits: coupon.prCount,
        productType: 'pr',
        notes: `Coupon: ${normalizedCode}`.slice(0, 48),
        createdAt: new Date(),
      })

      return { success: true, credits: coupon.prCount }
    })

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true, credits: result.credits })
  } catch (error) {
    console.error('Error redeeming coupon:', error)
    return NextResponse.json({ error: 'Failed to redeem code' }, { status: 500 })
  }
}
