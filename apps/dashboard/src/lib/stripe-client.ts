/**
 * Client-side Stripe helpers. Safe to import in 'use client' components.
 */

/**
 * Get the publishable key based on hostname.
 * Use in 'use client' components only.
 */
export function getStripePublishableKey(): string {
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const sandbox = host.includes('localhost') || host.includes('vercel.app')

  if (sandbox) {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_SANDBOX || ''
  }
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
}
