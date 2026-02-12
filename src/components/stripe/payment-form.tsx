'use client'

import { useState } from 'react'
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, Lock } from 'lucide-react'

interface PaymentFormProps {
  amount: number
  onSuccess: () => void
  onCancel: () => void
  releaseUuid: string
  paymentIntentId: string
}

export function PaymentForm({
  amount,
  onSuccess,
  onCancel,
  releaseUuid,
  paymentIntentId,
}: PaymentFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        // Confirm the payment on the server
        const response = await fetch(`/api/pr/${releaseUuid}/distribution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'confirm_payment',
            paymentIntentId,
          }),
        })

        const data = await response.json()

        if (data.success) {
          onSuccess()
        } else {
          setError(data.error || 'Failed to confirm payment')
        }
      } else {
        setError('Payment was not completed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium">Payment Details</h3>
        </div>

        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-1 text-sm text-gray-500">
          <Lock className="h-4 w-4" />
          Secure payment powered by Stripe
        </div>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!stripe || isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay $${(amount / 100).toFixed(0)}`
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
