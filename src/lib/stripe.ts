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
