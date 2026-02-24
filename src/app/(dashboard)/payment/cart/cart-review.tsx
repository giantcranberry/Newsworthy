'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ShoppingCart, Loader2, Lock, ArrowLeft, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { getStripePublishableKey } from '@/lib/stripe-client'

type CartItem = {
  id: number
  productId: number | null
  productName: string
  productDescription: string | null
  productType: string | null
  productCredits: number | null
  price: number
  stripePrice: string | null
}

type Company = {
  id: number
  companyName: string
  logoUrl: string | null
}

interface CartReviewProps {
  cartUuid: string
  items: CartItem[]
  companies: Company[]
  total: number
  userEmail: string
}

export function CartReview({ cartUuid, items, companies, total, userEmail }: CartReviewProps) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string>('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stripePromise = loadStripe(getStripePublishableKey())

  const handleProceedToPayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payment/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cartUuid,
          companyId: companyId ? parseInt(companyId) : null,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setClientSecret(data.clientSecret)
      setLoading(false)
    } catch (err) {
      setError('Failed to initialize payment. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/payment/paygo">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Your Order</h1>
          <p className="text-gray-500">Review your items before proceeding to payment</p>
        </div>
      </div>

      {/* Cart Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 pb-4 border-b last:border-0 last:pb-0">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900">{item.productName}</h4>
                {item.productDescription && (
                  <div
                    className="text-sm text-gray-500 mt-1 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_li]:text-gray-500 [&_p]:text-gray-500 [&_p]:my-1"
                    dangerouslySetInnerHTML={{ __html: item.productDescription }}
                  />
                )}
                {item.productCredits && (
                  <p className="text-sm text-gray-500 mt-1">
                    {item.productCredits} {item.productCredits === 1 ? 'Credit' : 'Credits'}
                  </p>
                )}
              </div>
              <p className="font-semibold text-gray-900 whitespace-nowrap">
                ${(item.price / 100).toFixed(2)}
              </p>
            </div>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between pt-4 border-t-2">
            <p className="text-lg font-bold text-gray-900">Total</p>
            <p className="text-2xl font-bold text-gray-900">${(total / 100).toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Brand Profile Selection */}
      {companies.length > 0 && !clientSecret && (
        <Card>
          <CardHeader>
            <CardTitle>Allocate Credits To</CardTitle>
            <CardDescription>
              Select a brand profile to receive the credits, or leave blank to add to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="0">My Account (no specific brand)</option>
              {companies.map((co) => (
                <option key={co.id} value={co.id.toString()}>
                  {co.companyName}
                </option>
              ))}
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Payment Section */}
      {!clientSecret ? (
        <div className="space-y-3">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
          )}
          <Button
            onClick={handleProceedToPayment}
            disabled={loading}
            className="w-full bg-cyan-800 text-white hover:bg-cyan-900"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading payment form...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Proceed to Secure Checkout
              </>
            )}
          </Button>
          <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
            <Lock className="h-3 w-3" />
            Payments secured by Stripe
          </div>
        </div>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: { colorPrimary: '#155e75' },
            },
          }}
        >
          <CheckoutForm total={total} cartUuid={cartUuid} />
        </Elements>
      )}
    </div>
  )
}

function CheckoutForm({ total, cartUuid }: { total: number; cartUuid: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setIsProcessing(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/thanks?cart=${cartUuid}`,
        },
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setIsProcessing(false)
      }
      // On success, Stripe redirects to return_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentElement options={{ layout: 'tabs' }} />
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">{error}</div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-cyan-800 text-white hover:bg-cyan-900"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Processing payment...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            Pay ${(total / 100).toFixed(2)}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
        <Lock className="h-3 w-3" />
        Payments secured by Stripe
      </div>
    </form>
  )
}
