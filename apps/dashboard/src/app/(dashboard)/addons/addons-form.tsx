'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PaymentForm } from '@/components/stripe/payment-form'
import { Check, Loader2, AlertCircle, ShoppingCart, Zap, Sparkles, Star, Crown, Rocket, Target } from 'lucide-react'
import { getStripePublishableKey } from '@/lib/stripe-client'
import { Select } from '@/components/ui/select'

interface AddonsFormProps {
  companies: { id: number; name: string }[]
}

interface AddonProduct {
  id: number
  name: string
  description: string | null
  price: number
  priceDisplay: string
  type: string
  icon: string | null
  label: string | null
  logoUrl: string | null
  productCredits: number
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Sparkles, Star, Crown, Rocket, Target,
}

function ProductIcon({ iconName, className }: { iconName: string | null; className?: string }) {
  if (!iconName) {
    return <Zap className={className} />
  }
  const trimmed = iconName.trim()
  if (trimmed.startsWith('fa:') || trimmed.startsWith('fa-') || trimmed.startsWith('fab ') || trimmed.startsWith('fas ') || trimmed.startsWith('far ')) {
    const faClass = trimmed.startsWith('fa:') ? trimmed.slice(3) : trimmed
    return <i className={`${faClass} ${className || ''}`} aria-hidden="true" />
  }
  const LucideIcon = ICON_MAP[trimmed] || Zap
  return <LucideIcon className={className} />
}

// Split description on --- marker. Returns [preview, full] or [full, null] if no marker.
function splitDescription(html: string | null): { preview: string | null; full: string | null; hasMore: boolean } {
  if (!html) return { preview: null, full: null, hasMore: false }
  // The --- can appear in many HTML forms:
  // <p><strong>---</strong></p>, <p>---</p>, <hr>,
  // or embedded in a tag like <h3>---<br>...</h3>
  const separators = [
    /<p[^>]*>\s*<strong>\s*-{3,}\s*<\/strong>\s*<\/p>/i,
    /<p[^>]*>\s*-{3,}\s*<\/p>/i,
    /<hr\s*\/?>/i,
  ]
  for (const sep of separators) {
    const match = html.match(sep)
    if (match && match.index !== undefined) {
      const preview = html.substring(0, match.index).trim()
      const rest = html.substring(match.index + match[0].length).trim()
      return { preview, full: rest, hasMore: true }
    }
  }
  // Handle --- embedded inside a tag like <h3 dir="ltr">---<br><br>What You Get</h3>
  // or standalone text ---
  // Use a broader regex that finds --- anywhere after a > or at start
  const idx = html.search(/-{3,}/)
  if (idx !== -1) {
    // Walk back to find the opening tag boundary
    const before = html.substring(0, idx)
    const lastOpenTag = before.lastIndexOf('<')
    const lastCloseTag = before.lastIndexOf('>')
    // If --- is inside a tag's content (lastCloseTag < lastOpenTag would mean inside a tag attribute, skip)
    const splitPoint = lastCloseTag >= lastOpenTag ? idx : lastOpenTag
    const preview = html.substring(0, splitPoint).trim()
    // Clean up the rest: remove the --- and surrounding <br> tags
    const rest = html.substring(splitPoint).replace(/^[^>]*>\s*-{3,}\s*(<br\s*\/?>|\s)*/i, '').replace(/^-{3,}\s*(<br\s*\/?>|\s)*/i, '').trim()
    if (preview.length > 0 && rest.length > 0) {
      return { preview, full: rest, hasMore: true }
    }
  }
  return { preview: html, full: null, hasMore: false }
}

export function AddonsForm({ companies }: AddonsFormProps) {
  const router = useRouter()
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0)
  const [products, setProducts] = useState<AddonProduct[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [isFetching, setIsFetching] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [readMoreProduct, setReadMoreProduct] = useState<AddonProduct | null>(null)

  // Stripe state
  const [showPayment, setShowPayment] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)

  useEffect(() => {
    const key = getStripePublishableKey()
    if (key) {
      setStripePromise(loadStripe(key))
    }
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch('/api/addons/checkout')
        if (response.ok) {
          const data = await response.json()
          setProducts(data.products || [])
        }
      } catch (err) {
        console.error('Failed to fetch addon products:', err)
      } finally {
        setIsFetching(false)
      }
    }
    fetchProducts()
  }, [])

  const selectedProducts = products.filter(p => selected.has(p.id))
  const total = selectedProducts.reduce((sum, p) => sum + p.price, 0)

  const toggleProduct = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleCheckout = async () => {
    if (selected.size === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/addons/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payment_intent',
          productIds: Array.from(selected),
          companyId: selectedCompanyId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment')
      }

      setClientSecret(data.clientSecret)
      setPaymentIntentId(data.paymentIntentId)
      setShowPayment(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const confirmPayment = async (intentId: string): Promise<{ success: boolean; error?: string }> => {
    const response = await fetch('/api/addons/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'confirm_payment',
        paymentIntentId: intentId,
      }),
    })
    return response.json()
  }

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    setPaymentSuccess(true)
    setSelected(new Set())
    setTimeout(() => {
      router.push('/dashboard')
    }, 2000)
  }

  const handlePaymentCancel = () => {
    setShowPayment(false)
    setClientSecret(null)
    setPaymentIntentId(null)
  }

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // Payment form view
  if (showPayment && clientSecret && stripePromise && paymentIntentId) {
    return (
      <div className="space-y-6">
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-300">
                    {selected.size} add-on{selected.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {selectedProducts.map(p => p.name).join(', ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">
                  ${(total / 100).toFixed(2)}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: '#2563eb',
                borderRadius: '8px',
              },
            },
          }}
        >
          <PaymentForm
            amount={total}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
            paymentIntentId={paymentIntentId}
            confirmPayment={confirmPayment}
          />
        </Elements>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Add-ons</h1>
          <p className="text-gray-500 dark:text-gray-400">Select add-on services for your brand</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="relative flex items-center gap-2 rounded-lg bg-cyan-800 dark:bg-cyan-600 px-4 py-2.5 text-white transition-colors hover:bg-cyan-900 dark:hover:bg-cyan-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-5 w-5" />
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                  {selected.size}
                </span>
              </>
            )}
            <span className="font-medium">${(total / 100).toFixed(2)}</span>
          </button>
        )}
      </div>

      {paymentSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg">
          <Check className="h-5 w-5" />
          <span>Payment successful! Your add-on credits have been applied. Redirecting...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Brand selector */}
      <Card>
        <CardContent className="pt-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Brand
          </label>
          <Select
            value={selectedCompanyId.toString()}
            onChange={(e) => setSelectedCompanyId(parseInt(e.target.value))}
          >
            <option value="0">My Account</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      {/* Product cards */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {products.map((product) => {
            const isSelected = selected.has(product.id)

            return (
              <Card
                key={product.id}
                className={`relative transition-all flex flex-col ${
                  isSelected
                    ? 'ring-2 ring-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 cursor-pointer'
                    : 'hover:shadow-md cursor-pointer'
                }`}
                onClick={() => toggleProduct(product.id)}
              >
                {(product.label) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-cyan-800 dark:bg-cyan-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
                      {product.label}
                    </span>
                  </div>
                )}
                <CardHeader className="text-center flex-1">
                  <div className="flex justify-end mb-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleProduct(product.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className="flex justify-center mb-1">
                    {product.logoUrl ? (
                      <div className="p-2 rounded-xl">
                        <img src={product.logoUrl} alt="" className="h-24 w-24 object-contain" />
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-cyan-800/10 dark:bg-cyan-400/10">
                        <ProductIcon iconName={product.icon} className="h-10 w-10 text-cyan-800 dark:text-cyan-400" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-2xl font-bold pb-3">{product.name}</CardTitle>
                  {(() => {
                    const { preview, hasMore } = splitDescription(product.description)
                    return (
                      <>
                        {preview && (
                          <div
                            className="text-sm text-gray-500 dark:text-gray-400 prose prose-sm max-w-none text-left [&_ul]:list-disc [&_ul]:pl-4 [&_li]:text-gray-500 dark:[&_li]:text-gray-400 [&_p]:text-gray-500 dark:[&_p]:text-gray-400 [&_p]:my-1"
                            dangerouslySetInnerHTML={{ __html: preview }}
                          />
                        )}
                        {hasMore && (
                          <button
                            type="button"
                            className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline mt-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              setReadMoreProduct(product)
                            }}
                          >
                            Read More...
                          </button>
                        )}
                      </>
                    )
                  })()}
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2 text-center">
                    ${(product.price / 100).toFixed(2)}
                  </div>
                  <Button
                    variant="default"
                    size="lg"
                    className={`w-full mt-4 text-base font-semibold ${
                      isSelected
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleProduct(product.id)
                    }}
                    disabled={isLoading}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {isSelected ? 'Remove from Cart' : 'Add to Cart'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
            No add-on products are currently available.
          </CardContent>
        </Card>
      )}

      {/* Sticky Cart Footer */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t shadow-lg z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ShoppingCart className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">
                  {selected.size} {selected.size === 1 ? 'item' : 'items'} selected
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedProducts.map(p => p.name).join(', ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  ${(total / 100).toFixed(2)}
                </p>
              </div>
              <Button
                onClick={handleCheckout}
                disabled={isLoading}
                className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 px-8"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  'Checkout'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for sticky footer */}
      {selected.size > 0 && <div className="h-24" />}

      {/* Read More Dialog */}
      <Dialog open={!!readMoreProduct} onOpenChange={(open) => !open && setReadMoreProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {readMoreProduct && (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-4">
                  {readMoreProduct.logoUrl ? (
                    <div className="p-3 rounded-xl">
                      <img src={readMoreProduct.logoUrl} alt="" className="h-24 w-24 object-contain" />
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-cyan-800/10 dark:bg-cyan-400/10">
                      <ProductIcon iconName={readMoreProduct.icon} className="h-10 w-10 text-cyan-800 dark:text-cyan-400" />
                    </div>
                  )}
                </div>
                <DialogTitle className="text-xl text-center">{readMoreProduct.name}</DialogTitle>
              </DialogHeader>
              {readMoreProduct.description && (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&_ul]:list-disc [&_ul]:pl-4 [&_p]:my-2"
                  dangerouslySetInnerHTML={{
                    __html: readMoreProduct.description
                      .replace(/<p[^>]*>\s*<strong>\s*-{3,}\s*<\/strong>\s*<\/p>/gi, '')
                      .replace(/<p[^>]*>\s*-{3,}\s*<\/p>/gi, '')
                      .replace(/<hr\s*\/?>/gi, '')
                      .replace(/(<(?:h[1-6]|p|div)[^>]*>)\s*-{3,}\s*(<br\s*\/?>|\s)*/gi, '$1')
                  }}
                />
              )}
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div className="text-2xl font-bold">${(readMoreProduct.price / 100).toFixed(2)}</div>
                <Button
                  className={`text-base font-semibold ${
                    selected.has(readMoreProduct.id)
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white'
                  }`}
                  onClick={() => {
                    toggleProduct(readMoreProduct.id)
                    setReadMoreProduct(null)
                  }}
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  {selected.has(readMoreProduct.id) ? 'Remove from Cart' : 'Add to Cart'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
