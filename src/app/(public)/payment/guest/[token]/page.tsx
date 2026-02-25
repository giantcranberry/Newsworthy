import { db } from '@/db'
import { paymentLinks } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { GuestCheckout } from './guest-checkout'
import type { PaymentLinkProduct } from '@/db/schema/payment'

export default async function GuestCheckoutPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const link = await db.query.paymentLinks.findFirst({
    where: eq(paymentLinks.token, token),
    with: { company: true },
  })

  if (!link) {
    notFound()
  }

  // Already used
  if (link.usedAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Already Used</h1>
          <p className="text-gray-600">This payment link has already been used. Please contact the sender for a new link.</p>
        </div>
      </div>
    )
  }

  // Expired
  if (link.expiresAt && new Date() > link.expiresAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This payment link has expired. Please contact the sender for a new link.</p>
        </div>
      </div>
    )
  }

  const products = link.productsJson as PaymentLinkProduct[]

  return (
    <GuestCheckout
      token={token}
      products={products}
      total={link.cartTotal}
      companyName={link.company?.companyName || ''}
    />
  )
}
