'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaymentForm } from '@/components/stripe/payment-form'
import { getStripePublishableKey } from '@/lib/stripe-client'
import { Loader2, Check, AlertCircle, Coins, ArrowRight } from 'lucide-react'

interface CreditSummary {
  totalCredits: number
  earliestExpiresAt: string | null
  batches: Array<{
    id: number
    credits: number
    expiresAt: string | null
    createdAt: string
  }>
}

interface PodcastProduct {
  id: number
  name: string
  description: string | null
  price: number
  priceDisplay: string
  productCredits: number
  label: string | null
  perUnitDisplay: string | null
}

interface FundingTabProps {
  feedUuid: string
  credits: CreditSummary
}

export function FundingTab({ feedUuid, credits: initialCredits }: FundingTabProps) {
  const router = useRouter()
  const [products, setProducts] = useState<PodcastProduct[]>([])
  const [isFetching, setIsFetching] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [credits, setCredits] = useState(initialCredits)

  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [pendingProduct, setPendingProduct] = useState<PodcastProduct | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [successCredits, setSuccessCredits] = useState<number | null>(null)

  useEffect(() => {
    const key = getStripePublishableKey()
    if (key) setStripePromise(loadStripe(key))
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsFetching(true)
      setFetchError(null)
      try {
        const res = await fetch(`/api/podcasts/feeds/${feedUuid}/checkout`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setFetchError(data.error || 'Failed to load packages')
        } else {
          setProducts(data.products || [])
        }
      } catch (err) {
        if (!cancelled) setFetchError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setIsFetching(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [feedUuid])

  const handleBuy = async (product: PodcastProduct) => {
    setPaymentError(null)
    setPendingProduct(product)
    setCreating(true)
    try {
      const res = await fetch(`/api/podcasts/feeds/${feedUuid}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_payment_intent', productId: product.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPaymentError(data.error || 'Could not start checkout')
        setPendingProduct(null)
        return
      }
      setClientSecret(data.clientSecret)
      setPaymentIntentId(data.paymentIntentId)
      setShowPayment(true)
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Could not start checkout')
      setPendingProduct(null)
    } finally {
      setCreating(false)
    }
  }

  const handleConfirm = async (pid: string): Promise<{ success: boolean; error?: string }> => {
    const res = await fetch(`/api/podcasts/feeds/${feedUuid}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'confirm_payment', paymentIntentId: pid }),
    })
    const data = await res.json()
    return { success: res.ok && data.success, error: data.error }
  }

  const handleSuccess = () => {
    setShowPayment(false)
    setClientSecret(null)
    setPaymentIntentId(null)
    const purchased = pendingProduct?.productCredits ?? 0
    setSuccessCredits(purchased)
    setCredits((c) => ({ ...c, totalCredits: c.totalCredits + purchased }))
    setPendingProduct(null)
    // Setup complete — return to the episode list.
    router.push(`/pr/podcast/${feedUuid}`)
    router.refresh()
  }

  const handleCancel = () => {
    setShowPayment(false)
    setClientSecret(null)
    setPaymentIntentId(null)
    setPendingProduct(null)
  }

  const expirySoon = credits.earliestExpiresAt
    ? new Date(credits.earliestExpiresAt).toLocaleDateString()
    : null

  return (
    <div className="space-y-6">
      {/* Current balance */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/40">
              <Coins className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Podcast PR credits for this brand
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {credits.totalCredits}
              </p>
              {expirySoon && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Earliest batch expires {expirySoon}
                </p>
              )}
            </div>
          </div>
          {successCredits != null && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-green-100 px-3 py-1.5 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300">
              <Check className="h-4 w-4" />
              Added {successCredits} credit{successCredits === 1 ? '' : 's'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Packages */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Buy Podcast PR Credits
        </h2>
        <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
          <li>Credits valid for 2 years.</li>
          <li>Credits are brand/podcast specific.</li>
          <li>Credits can only be used for this podcast.</li>
          <li>Credits cannot be used for non-podcast press releases.</li>
        </ul>

        {isFetching ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-10 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading packages…
            </CardContent>
          </Card>
        ) : fetchError ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4" />
              {fetchError}
            </CardContent>
          </Card>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-600 dark:text-gray-400">
              No podcast PR packages are configured yet. An admin needs to add products to the{' '}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">products</code> table with{' '}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">
                product_type = 'podcast_pr'
              </code>
              .
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => {
              const isPending = creating && pendingProduct?.id === p.id
              return (
                <Card key={p.id} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col p-5">
                    {p.label && (
                      <span className="mb-2 inline-flex w-fit items-center rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                        {p.label}
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {p.name}
                    </h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {p.priceDisplay}
                      </span>
                      {p.perUnitDisplay && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {p.perUnitDisplay}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {p.productCredits} credit{p.productCredits === 1 ? '' : 's'}
                    </p>
                    <div className="mt-auto pt-4">
                      <Button
                        onClick={() => handleBuy(p)}
                        disabled={creating}
                        className="w-full gap-2 bg-cyan-800 dark:bg-cyan-600 text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 cursor-pointer"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting…
                          </>
                        ) : (
                          'Buy'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {paymentError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {paymentError}
          </div>
        )}
      </div>

      {/* Past batches */}
      {credits.batches.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Active credit batches
          </h3>
          <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Purchased</th>
                  <th className="px-3 py-2">Credits</th>
                  <th className="px-3 py-2">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {credits.batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{b.credits}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-gray-200 pt-6 dark:border-gray-800">
        <Link
          href={`/pr/podcast/${feedUuid}`}
          className="inline-flex items-center gap-2 rounded-md bg-cyan-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-900 dark:bg-cyan-600 dark:hover:bg-cyan-700"
        >
          Finish Setup
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stripe Elements modal */}
      <Dialog open={showPayment} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pendingProduct ? `Pay ${pendingProduct.priceDisplay} for ${pendingProduct.name}` : 'Checkout'}
            </DialogTitle>
          </DialogHeader>
          {stripePromise && clientSecret && paymentIntentId && pendingProduct && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: 'stripe' } }}
            >
              <PaymentForm
                amount={pendingProduct.price}
                paymentIntentId={paymentIntentId}
                confirmPayment={handleConfirm}
                onSuccess={handleSuccess}
                onCancel={handleCancel}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
