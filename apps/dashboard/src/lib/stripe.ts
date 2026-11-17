import Stripe from 'stripe'
import { headers } from 'next/headers'

/**
 * Detect sandbox mode from the request host.
 * Sandbox: localhost, vercel.app
 * Production: everything else (e.g. newsworthy.ai)
 */
export async function isSandbox(): Promise<boolean> {
  try {
    const headersList = await headers()
    const host = headersList.get('host') || ''
    return host.includes('localhost') || host.includes('vercel.app')
  } catch {
    return !!process.env.STRIPE_SECRET_SANDBOX
  }
}

/**
 * Get the Stripe secret key for the current environment.
 */
export async function getStripeSecretKey(): Promise<string> {
  const sandbox = await isSandbox()
  const key = sandbox
    ? process.env.STRIPE_SECRET_SANDBOX
    : process.env.STRIPE_SECRET

  if (!key) {
    throw new Error(
      sandbox
        ? 'STRIPE_SECRET_SANDBOX is not set'
        : 'STRIPE_SECRET is not set',
    )
  }
  return key
}

/**
 * Get a Stripe client for the current environment.
 */
export async function getStripe(): Promise<Stripe> {
  const key = await getStripeSecretKey()
  return new Stripe(key, { apiVersion: '2025-12-15.clover' })
}

/**
 * Get the Stripe webhook secret for the current environment.
 */
export async function getWebhookSecret(): Promise<string> {
  const sandbox = await isSandbox()
  const secret = sandbox
    ? process.env.STRIPE_WEBHOOK_SANDBOX
    : process.env.STRIPE_WEBHOOK_SECRET

  if (!secret) {
    throw new Error(
      sandbox
        ? 'STRIPE_WEBHOOK_SANDBOX is not set'
        : 'STRIPE_WEBHOOK_SECRET is not set',
    )
  }
  return secret
}

export interface PayingUser {
  userId: number
  email?: string | null
  name?: string | null
}

/**
 * The Stripe customer for a signed-in user, so payments show their email in
 * Stripe, Stripe can send the receipt, and the charge appears in the user's
 * purchase history (which lists charges by customer).
 *
 * Reuses user_profiles.stripe when it exists in this Stripe mode, otherwise
 * finds a customer by email or creates one. Only live-mode customer ids are
 * saved to the profile, so a sandbox run never overwrites the live id.
 * Returns null instead of throwing, so a Stripe customer problem never blocks
 * a payment.
 */
export async function getOrCreateStripeCustomer(stripe: Stripe, user: PayingUser): Promise<string | null> {
  try {
    const { db } = await import('@/db')
    const { userProfiles } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, user.userId),
    })

    if (profile?.stripe) {
      try {
        const existing = await stripe.customers.retrieve(profile.stripe)
        if (!('deleted' in existing && existing.deleted)) return existing.id
      } catch {
        // Not in this Stripe mode (e.g. live id in sandbox) or deleted
      }
    }

    const email = user.email?.trim() || undefined
    let customer: Stripe.Customer | null = null
    if (email) {
      const found = await stripe.customers.list({ email, limit: 1 })
      customer = found.data[0] ?? null
    }
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        name: user.name?.trim() || undefined,
        metadata: { user_id: user.userId.toString() },
      })
    }

    if (profile && customer.livemode && profile.stripe !== customer.id) {
      await db.update(userProfiles).set({ stripe: customer.id }).where(eq(userProfiles.userId, user.userId))
    }
    return customer.id
  } catch (error) {
    console.error('[stripe] could not get or create customer:', error)
    return null
  }
}

/**
 * Add the paying user to PaymentIntent params: Stripe customer, receipt email,
 * and the user's email in metadata. Existing params win where they're set.
 *
 *   stripe.paymentIntents.create(await withPayingUser(stripe, user, { amount, ... }))
 */
export async function withPayingUser(
  stripe: Stripe,
  user: PayingUser,
  params: Stripe.PaymentIntentCreateParams,
): Promise<Stripe.PaymentIntentCreateParams> {
  const customer = params.customer ?? (await getOrCreateStripeCustomer(stripe, user))
  const email = user.email?.trim() || undefined
  return {
    ...params,
    ...(customer ? { customer } : {}),
    ...(params.receipt_email ?? email ? { receipt_email: params.receipt_email ?? email } : {}),
    metadata: {
      userId: user.userId.toString(),
      ...(email ? { userEmail: email.slice(0, 500) } : {}),
      ...(params.metadata || {}),
    },
  }
}
