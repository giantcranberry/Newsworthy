import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { podcastFeeds, products, brandCredits } from '@/db/schema'
import { eq, and, or, isNull } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'

const PODCAST_PRODUCT_TYPE = 'podcast_pr'
const CREDIT_LIFETIME_MS = 2 * 365 * 24 * 60 * 60 * 1000

function getStripeSecretKey(host: string): string | undefined {
  const isSandbox = host.includes('localhost') || host.includes('vercel.app')
  if (isSandbox) return process.env.STRIPE_SECRET_SANDBOX
  return process.env.STRIPE_SECRET
}

async function loadFeedAndAuth(userId: number, feedUuid: string) {
  const feed = await db.query.podcastFeeds.findFirst({
    where: and(eq(podcastFeeds.uuid, feedUuid), eq(podcastFeeds.isDeleted, false)),
    columns: { id: true, companyId: true, title: true },
  })
  if (!feed) return { error: 'Not found' as const, status: 404 }

  const allowed = await getUserCompanyIds(userId, 'collaborator')
  if (!allowed.includes(feed.companyId)) {
    return { error: 'Forbidden' as const, status: 403 }
  }
  return { feed }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  const { uuid } = await params
  const res = await loadFeedAndAuth(userId, uuid)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const availableProducts = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        or(eq(products.isDeleted, false), isNull(products.isDeleted)),
        eq(products.productType, PODCAST_PRODUCT_TYPE),
        or(
          isNull(products.partnerId),
          partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId),
        ),
      ),
    )
    .orderBy(products.sortOrder, products.price)

  return NextResponse.json({
    products: availableProducts.map((p) => ({
      id: p.id,
      name: p.displayName || p.shortName || 'Podcast PR',
      description: p.description,
      price: p.price,
      priceDisplay: `$${(p.price / 100).toFixed(0)}`,
      productCredits: p.productCredits || 1,
      label: p.label,
      perUnitDisplay:
        p.productCredits && p.productCredits > 0
          ? `$${Math.round(p.price / p.productCredits / 100)} each`
          : null,
    })),
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  const { uuid: feedUuid } = await params
  const res = await loadFeedAndAuth(userId, feedUuid)
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })
  const { feed } = res

  const body = await request.json().catch(() => ({}))
  const { action } = body || {}

  const headersList = await headers()
  const host = headersList.get('host') || 'localhost'
  const stripeApiKey = getStripeSecretKey(host)
  if (!stripeApiKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }
  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(stripeApiKey)

  if (action === 'create_payment_intent') {
    const productId = parseInt(body.productId)
    if (!productId) {
      return NextResponse.json({ error: 'Product is required' }, { status: 400 })
    }

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, productId),
        eq(products.isActive, true),
        eq(products.productType, PODCAST_PRODUCT_TYPE),
        or(
          isNull(products.partnerId),
          partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId),
        ),
      ),
    })
    if (!product) {
      return NextResponse.json({ error: 'Invalid or unavailable product' }, { status: 400 })
    }

    const description = `Podcast PR credits — ${product.displayName || product.shortName}`
    const paymentIntent = await stripe.paymentIntents.create({
      amount: product.price,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'podcast_pr',
        userId: userId.toString(),
        companyId: feed.companyId.toString(),
        feedUuid,
        productIds: product.id.toString(),
        productNames: (product.displayName || product.shortName || '').substring(0, 500),
      },
      description,
    })

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: product.price,
      credits: product.productCredits || 1,
    })
  }

  if (action === 'confirm_payment') {
    const { paymentIntentId } = body
    if (!paymentIntentId) {
      return NextResponse.json({ error: 'Payment intent ID required' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
    }
    if (paymentIntent.metadata?.userId !== userId.toString()) {
      return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 })
    }
    if (paymentIntent.metadata?.companyId !== feed.companyId.toString()) {
      return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 })
    }

    // Idempotency: skip if we've already credited this paymentIntent.
    const alreadyCredited = await db.query.brandCredits.findFirst({
      where: and(
        eq(brandCredits.companyId, feed.companyId),
        eq(brandCredits.productType, PODCAST_PRODUCT_TYPE),
        // notes field carries the paymentIntent id; truncated to 48 chars
        eq(brandCredits.notes, paymentIntentId.substring(0, 48)),
      ),
      columns: { id: true },
    })
    if (alreadyCredited) {
      return NextResponse.json({ success: true, alreadyCredited: true })
    }

    const productIdStrs = paymentIntent.metadata?.productIds?.split(',') || []
    const productIdNums = productIdStrs.map(Number).filter(Boolean)
    if (productIdNums.length === 0) {
      return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
    }

    const purchased = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.productType, PODCAST_PRODUCT_TYPE),
          or(
            eq(products.id, productIdNums[0]),
            ...productIdNums.slice(1).map((id) => eq(products.id, id)),
          ),
        ),
      )

    const now = new Date()
    const expiresAt = new Date(now.getTime() + CREDIT_LIFETIME_MS)

    for (const product of purchased) {
      await db.insert(brandCredits).values({
        userId,
        companyId: feed.companyId,
        credits: product.productCredits || 1,
        productType: PODCAST_PRODUCT_TYPE,
        notes: paymentIntentId.substring(0, 48),
        expiresAt,
      })
    }

    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
