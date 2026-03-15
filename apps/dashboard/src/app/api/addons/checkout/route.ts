import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { brandCredits, products, company, companyMembers } from '@/db/schema'
import { eq, and, or, isNull, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

function getStripeSecretKey(host: string): string | undefined {
  const isSandbox = host.includes('localhost') || host.includes('vercel.app')
  if (isSandbox) {
    return process.env.STRIPE_SECRET_SANDBOX
  }
  return process.env.STRIPE_SECRET
}

async function getUserCompanies(userId: number) {
  const ownedCompanies = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
  })

  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const ownedIds = new Set(ownedCompanies.map((c) => c.id))
  const sharedIds = memberships.map((m) => m.companyId).filter((id) => !ownedIds.has(id))

  let sharedCompanies: typeof ownedCompanies = []
  if (sharedIds.length > 0) {
    sharedCompanies = await db.query.company.findMany({
      where: and(inArray(company.id, sharedIds), eq(company.isDeleted, false)),
    })
  }

  return [...ownedCompanies, ...sharedCompanies]
}

export async function GET() {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  try {
    // Get add-on products (productType = 'addon')
    const availableProducts = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          or(eq(products.isDeleted, false), isNull(products.isDeleted)),
          eq(products.productType, 'addon'),
          or(
            isNull(products.partnerId),
            partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId)
          )
        )
      )
      .orderBy(products.sortOrder, products.price)

    const productList = availableProducts.map((p) => ({
      id: p.id,
      name: p.displayName || p.shortName || 'Add-on',
      description: p.description,
      price: p.price,
      priceDisplay: `$${(p.price / 100).toFixed(0)}`,
      type: p.productType!,
      icon: p.icon,
      label: p.label,
      logoUrl: p.logoUrl,
      productCredits: p.productCredits || 1,
    }))

    // Get user's companies for brand selector
    const userCompanies = await getUserCompanies(userId)
    const companies = userCompanies.map((c) => ({
      id: c.id,
      name: c.companyName,
    }))

    return NextResponse.json({
      products: productList,
      companies,
    })
  } catch (error) {
    console.error('[API] Error fetching addon products:', error)
    return NextResponse.json({ error: 'Failed to fetch addon products' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  try {
    const body = await request.json()
    const { action } = body

    if (action === 'create_payment_intent') {
      const { productIds, companyId } = body

      if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
        return NextResponse.json({ error: 'No products selected' }, { status: 400 })
      }

      if (companyId === undefined || companyId === null) {
        return NextResponse.json({ error: 'Brand selection required' }, { status: 400 })
      }

      // Validate products exist and are addon type
      const selectedProducts = await db
        .select()
        .from(products)
        .where(
          and(
            inArray(products.id, productIds),
            eq(products.isActive, true),
            or(eq(products.isDeleted, false), isNull(products.isDeleted)),
            eq(products.productType, 'addon'),
            or(
              isNull(products.partnerId),
              partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId)
            )
          )
        )

      if (selectedProducts.length !== productIds.length) {
        return NextResponse.json({ error: 'Invalid or unavailable product' }, { status: 400 })
      }

      // Calculate total
      const totalAmount = selectedProducts.reduce((sum, p) => sum + p.price, 0)

      // Get Stripe key
      const headersList = await headers()
      const host = headersList.get('host') || 'localhost'
      const stripeApiKey = getStripeSecretKey(host)

      if (!stripeApiKey) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeApiKey)

      const productNames = selectedProducts.map(p => p.displayName || p.shortName).join(', ')
      const description = `Add-on purchase: ${productNames}`

      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: 'addon',
          userId: userId.toString(),
          companyId: companyId.toString(),
          productIds: productIds.join(','),
          productNames: productNames.substring(0, 500),
        },
        description,
      })

      return NextResponse.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      })
    }

    if (action === 'confirm_payment') {
      const { paymentIntentId } = body

      if (!paymentIntentId) {
        return NextResponse.json({ error: 'Payment intent ID required' }, { status: 400 })
      }

      const headersList = await headers()
      const host = headersList.get('host') || 'localhost'
      const stripeApiKey = getStripeSecretKey(host)

      if (!stripeApiKey) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeApiKey)

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
      }

      // Verify this payment belongs to this user
      if (paymentIntent.metadata?.userId !== userId.toString()) {
        return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 })
      }

      const companyIdRaw = parseInt(paymentIntent.metadata?.companyId || '0')
      const productIdStrs = paymentIntent.metadata?.productIds?.split(',') || []
      const productIdNums = productIdStrs.map(Number).filter(Boolean)

      if (productIdNums.length === 0) {
        return NextResponse.json({ error: 'Invalid payment metadata' }, { status: 400 })
      }

      // companyId=0 means "My Account" (no brand), store as null
      const companyIdValue = companyIdRaw > 0 ? companyIdRaw : null

      // Fetch the purchased products to get credit amounts
      const purchasedProducts = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIdNums))

      // Create brand_credits entries for each product
      for (const product of purchasedProducts) {
        const credits = product.productCredits || 1
        await db.insert(brandCredits).values({
          userId,
          companyId: companyIdValue,
          credits,
          productType: product.productType,
          notes: `Add-on: ${(product.displayName || product.shortName || '').substring(0, 30)}`,
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error processing addon checkout:', error)
    return NextResponse.json({ error: 'Failed to process checkout' }, { status: 500 })
  }
}
