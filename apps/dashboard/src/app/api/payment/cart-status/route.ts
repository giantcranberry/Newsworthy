import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { carts, brandCredits } from '@/db/schema'
import { eq, and, sql, isNotNull } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const cartUuid = request.nextUrl.searchParams.get('cart')

  if (!cartUuid) {
    return NextResponse.json({ error: 'Missing cart' }, { status: 400 })
  }

  // Check if cart items are fulfilled
  const cartItems = await db
    .select({
      id: carts.id,
      fulfilledAt: carts.fulfilledAt,
    })
    .from(carts)
    .where(
      and(
        eq(carts.cartUuid, cartUuid),
        eq(carts.userId, userId),
      ),
    )

  if (cartItems.length === 0) {
    return NextResponse.json({ error: 'Cart not found' }, { status: 404 })
  }

  const fulfilled = cartItems.every((item) => item.fulfilledAt !== null)

  if (!fulfilled) {
    return NextResponse.json({ fulfilled: false })
  }

  // Cart is fulfilled — return current credit balances
  const result = await db
    .select({
      prCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} IN ('pr', 'credits') THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      yahooCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'yahoo' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      enhancedCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'enhanced' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
    })
    .from(brandCredits)
    .where(eq(brandCredits.userId, userId))

  return NextResponse.json({
    fulfilled: true,
    balance: {
      prCredits: Number(result[0]?.prCredits || 0),
      yahooCredits: Number(result[0]?.yahooCredits || 0),
      enhancedCredits: Number(result[0]?.enhancedCredits || 0),
    },
  })
}
