'use client'

import { useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ShoppingCart, Loader2, Lock, CreditCard, Mail } from 'lucide-react'
import { getStripePublishableKey } from '@/lib/stripe-client'

type Product = {
  stripe_price: string
  product_id: number
  name: string
  price: number
  credits: number
  product_type: string
}

interface GuestCheckoutProps {
  token: string
  products: Product[]
  total: number
  companyName: string
}

export function GuestCheckout({ token, products, total, companyName }: GuestCheckoutProps) {
  const [email, setEmail] = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stripePromise = loadStripe(getStripePublishableKey())

  const handleProceedToPayment = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payment/create-guest-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email }),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setClientSecret(data.clientSecret)
      setLoading(false)
    } catch {
      setError('Failed to initialize payment. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Complete Your Payment</h1>
          {companyName && (
            <p className="text-gray-500 dark:text-gray-400 mt-1">Order from {companyName}</p>
          )}
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {products.map((product, index) => (
              <div key={index} className="flex items-start justify-between gap-4 pb-4 border-b last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-gray-100">{product.name}</h4>
                  {product.credits > 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {product.credits} {product.credits === 1 ? 'Credit' : 'Credits'}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  ${(product.price / 100).toFixed(2)}
                </p>
              </div>
            ))}

            <div className="flex items-center justify-between pt-4 border-t-2">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${(total / 100).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Section */}
        {!clientSecret ? (
          <div className="space-y-4">
            {/* Email Input */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Your Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-2">A receipt will be sent to this email</p>
              </CardContent>
            </Card>

            {error && (
              <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">{error}</div>
            )}

            <Button
              onClick={handleProceedToPayment}
              disabled={loading || !email}
              className="w-full bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
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
            <div className="flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">
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
            <GuestCheckoutForm total={total} token={token} />
          </Elements>
        )}
      </div>
    </div>
  )
}

function GuestCheckoutForm({ total, token }: { total: number; token: string }) {
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
          return_url: `${window.location.origin}/payment/guest-thanks?token=${token}`,
        },
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setIsProcessing(false)
      }
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
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 rounded-lg">{error}</div>
      )}

      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700"
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

      <div className="flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <Lock className="h-3 w-3" />
        Payments secured by Stripe
      </div>
    </form>
  )
}
