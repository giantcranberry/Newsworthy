import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, brandCredits, products } from '@/db/schema'
import { eq, and, sql, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { sendPaymentReceiptEmail } from '@/lib/email'

// Get the correct Stripe secret key based on environment
function getStripeSecretKey(host: string): string | undefined {
  // Use sandbox keys for localhost and vercel.app domains
  const isSandbox = host.includes('localhost') || host.includes('vercel.app')

  if (isSandbox) {
    return process.env.STRIPE_SECRET_SANDBOX
  }

  // Production (newsworthy.ai)
  return process.env.STRIPE_SECRET
}

async function getAvailableProducts(partnerId: number | null) {
  // Get products that are:
  // - Active, not deleted, and is_upgrade = true
  // - Either global (partnerId is null) or for the user's partner
  const availableProducts = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.isActive, true),
        eq(products.isDeleted, false),
        eq(products.isUpgrade, true),
        or(
          isNull(products.partnerId),
          partnerId ? eq(products.partnerId, partnerId) : isNull(products.partnerId)
        )
      )
    )
    .orderBy(products.price)

  return availableProducts
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  try {
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
      with: {
        company: true,
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Get credit balance for all product types
    const credits = await db
      .select({
        productType: brandCredits.productType,
        totalCredits: sql<number>`sum(${brandCredits.credits})`.mapWith(Number),
      })
      .from(brandCredits)
      .where(
        and(
          eq(brandCredits.userId, userId),
          eq(brandCredits.companyId, release.companyId)
        )
      )
      .groupBy(brandCredits.productType)

    const creditBalance: Record<string, number> = {}
    credits.forEach((c) => {
      if (c.productType) {
        creditBalance[c.productType] = c.totalCredits
      }
    })

    // Get available products from database
    const availableProducts = await getAvailableProducts(partnerId)

    // Transform to expected format - use array to preserve order
    const productList = availableProducts
      .filter((p) => p.productType)
      .map((p) => ({
        id: p.id,
        name: p.displayName || p.shortName || 'Product',
        description: p.description,
        price: p.price,
        priceDisplay: `$${(p.price / 100).toFixed(0)}`,
        type: p.productType!,
        icon: p.icon,
        label: p.label,
        isSoloUpgrade: p.isSoloUpgrade ?? false,
      }))

    return NextResponse.json({
      distribution: release.distribution || null,
      creditBalance,
      products: productList,
    })
  } catch (error) {
    console.error('[API] Error fetching distribution:', error)
    return NextResponse.json({ error: 'Failed to fetch distribution info' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const partnerId = (session.user as any).partnerId || null

  try {
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const body = await request.json()
    const { action, productType, productTypes } = body

    // Get available products
    const availableProducts = await getAvailableProducts(partnerId)

    // Support both single productType and array of productTypes
    const selectedTypes: string[] = productTypes || (productType ? [productType] : [])

    // Validate all requested product types
    const selectedProducts = selectedTypes
      .map(type => availableProducts.find(p => p.productType === type))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)

    if (selectedTypes.length > 0 && selectedProducts.length !== selectedTypes.length) {
      return NextResponse.json({ error: 'Invalid or unavailable product type' }, { status: 400 })
    }

    if (action === 'use_credit' && productType) {
      const product = availableProducts.find(p => p.productType === productType)
      if (!product) {
        return NextResponse.json({ error: 'Invalid product type' }, { status: 400 })
      }

      // Check if user has credits
      const credits = await db
        .select({
          totalCredits: sql<number>`sum(${brandCredits.credits})`.mapWith(Number),
        })
        .from(brandCredits)
        .where(
          and(
            eq(brandCredits.userId, userId),
            eq(brandCredits.companyId, release.companyId),
            eq(brandCredits.productType, productType)
          )
        )

      const availableCredits = credits[0]?.totalCredits || 0

      if (availableCredits < 1) {
        return NextResponse.json({ error: 'Insufficient credits' }, { status: 400 })
      }

      // Deduct one credit
      await db.insert(brandCredits).values({
        userId,
        companyId: release.companyId,
        prId: release.id,
        credits: -1,
        productType,
        notes: `Used for PR: ${release.title?.substring(0, 30) || release.uuid}`,
      })

      // Update release distribution (append to existing)
      const currentDistribution = release.distribution ? release.distribution.split(',').filter(Boolean) : []
      if (!currentDistribution.includes(productType)) {
        currentDistribution.push(productType)
      }
      const newDistribution = currentDistribution.join(',')

      await db.update(releases)
        .set({ distribution: newDistribution })
        .where(eq(releases.id, release.id))

      return NextResponse.json({ success: true, distribution: newDistribution })
    }

    if (action === 'create_payment_intent') {
      if (selectedProducts.length === 0) {
        return NextResponse.json({ error: 'No products selected' }, { status: 400 })
      }

      // Get the host to determine which Stripe keys to use
      const headersList = await headers()
      const host = headersList.get('host') || 'localhost'
      const stripeApiKey = getStripeSecretKey(host)

      if (!stripeApiKey) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      // Import Stripe dynamically
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeApiKey)

      // Calculate total amount
      const totalAmount = selectedProducts.reduce((sum, p) => sum + p.price, 0)

      // Build description with product names, headline, and UUID
      const productNames = selectedProducts.map(p => p.displayName || p.shortName).join(', ')
      const releaseTitle = release.title || 'Untitled Press Release'
      const description = `${productNames} for "${releaseTitle}" (${uuid})`

      // Create a PaymentIntent (receipt sent via Resend after confirmation)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          releaseId: release.id.toString(),
          releaseUuid: uuid,
          releaseTitle: releaseTitle.substring(0, 500), // Stripe metadata limit
          userId: userId.toString(),
          productTypes: selectedTypes.join(','),
          productIds: selectedProducts.map(p => p.id).join(','),
          productNames: productNames.substring(0, 500), // Stripe metadata limit
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

      // Get the host to determine which Stripe keys to use
      const headersList = await headers()
      const host = headersList.get('host') || 'localhost'
      const stripeApiKey = getStripeSecretKey(host)

      if (!stripeApiKey) {
        return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
      }

      // Import Stripe dynamically
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeApiKey)

      // Retrieve and verify the payment intent
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

      if (paymentIntent.status !== 'succeeded') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
      }

      // Verify the payment is for this release
      if (paymentIntent.metadata?.releaseUuid !== uuid) {
        return NextResponse.json({ error: 'Payment mismatch' }, { status: 400 })
      }

      // Get product types from payment metadata
      const distribution = paymentIntent.metadata?.productTypes

      if (!distribution) {
        return NextResponse.json({ error: 'No products in payment' }, { status: 400 })
      }

      // Update release distribution
      await db.update(releases)
        .set({ distribution })
        .where(eq(releases.id, release.id))

      // Send receipt email
      const userEmail = session.user.email
      const userName = session.user.name || 'Customer'
      const releaseTitle = paymentIntent.metadata?.releaseTitle || release.title || 'Press Release'
      const productNamesStr = paymentIntent.metadata?.productNames || distribution
      const productNames = productNamesStr.split(',').map((s: string) => s.trim()).filter(Boolean)

      if (userEmail) {
        try {
          await sendPaymentReceiptEmail({
            to: userEmail,
            customerName: userName,
            releaseTitle,
            releaseUuid: uuid,
            productNames,
            amount: paymentIntent.amount,
            transactionId: paymentIntentId,
          })
        } catch (emailError) {
          // Log but don't fail the request if email fails
          console.error('[API] Failed to send receipt email:', emailError)
        }
      }

      return NextResponse.json({ success: true, distribution })
    }

    if (action === 'skip') {
      // User chose not to use premium distribution - set to standard
      await db.update(releases)
        .set({ distribution: 'standard' })
        .where(eq(releases.id, release.id))

      return NextResponse.json({ success: true, distribution: 'standard' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[API] Error processing distribution:', error)
    return NextResponse.json({ error: 'Failed to process distribution' }, { status: 500 })
  }
}

// Handle Stripe webhook for successful payments
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await db.query.releases.findFirst({
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { sessionId, productTypes } = await request.json()

    let distribution: string | null = null

    // Get the host to determine which Stripe keys to use
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost'
    const stripeApiKey = getStripeSecretKey(host)

    if (stripeApiKey && sessionId) {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(stripeApiKey)

      const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId)

      if (checkoutSession.payment_status !== 'paid') {
        return NextResponse.json({ error: 'Payment not completed' }, { status: 400 })
      }

      // Verify the session is for this release
      if (checkoutSession.metadata?.releaseUuid !== uuid) {
        return NextResponse.json({ error: 'Session mismatch' }, { status: 400 })
      }

      // Get product types from session metadata
      distribution = checkoutSession.metadata?.productTypes || null
    } else if (productTypes && Array.isArray(productTypes)) {
      distribution = productTypes.join(',')
    }

    if (!distribution) {
      return NextResponse.json({ error: 'No products specified' }, { status: 400 })
    }

    // Update release distribution
    await db.update(releases)
      .set({ distribution })
      .where(eq(releases.id, release.id))

    return NextResponse.json({ success: true, distribution })
  } catch (error) {
    console.error('[API] Error updating distribution:', error)
    return NextResponse.json({ error: 'Failed to update distribution' }, { status: 500 })
  }
}
