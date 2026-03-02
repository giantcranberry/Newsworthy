import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getStripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

const CACHE_TTL = 8 * 60 * 60 * 1000 // 8 hours

interface CachedCharges {
  data: StripeCharge[]
  fetchedAt: number
}

interface StripeCharge {
  id: string
  amount: number
  currency: string
  status: string
  description: string | null
  receiptUrl: string | null
  created: number
}

const chargesCache = new Map<string, CachedCharges>()

export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get Stripe customer ID from user profile
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  })

  const stripeCustomerId = profile?.stripe
  if (!stripeCustomerId) {
    return NextResponse.json({ charges: [] })
  }

  // Check cache
  const cached = chargesCache.get(stripeCustomerId)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ charges: cached.data, cachedAt: cached.fetchedAt })
  }

  try {
    const stripe = await getStripe()
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 100,
    })

    const data: StripeCharge[] = charges.data.map((c) => ({
      id: c.id,
      amount: c.amount,
      currency: c.currency,
      status: c.status,
      description: c.description,
      receiptUrl: c.receipt_url,
      created: c.created,
    }))

    chargesCache.set(stripeCustomerId, { data, fetchedAt: Date.now() })

    return NextResponse.json({ charges: data, cachedAt: Date.now() })
  } catch (error) {
    console.error('[Billing] Error fetching Stripe charges:', error)
    // Return cached data even if stale, if available
    if (cached) {
      return NextResponse.json({ charges: cached.data, cachedAt: cached.fetchedAt })
    }
    return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 })
  }
}
