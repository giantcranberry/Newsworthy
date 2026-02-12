'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements } from '@stripe/react-stripe-js'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WizardActions } from '@/components/pr-wizard/wizard-actions'
import { PaymentForm } from '@/components/stripe/payment-form'
import { CreditCard, Zap, Check, Loader2, Sparkles, AlertCircle, Star, Crown, Rocket, Target, Plus, X, ShoppingCart } from 'lucide-react'
import { cn } from '@/lib/utils'

// Get the correct Stripe publishable key based on environment
function getStripePublishableKey(): string {
  const host = typeof window !== 'undefined' ? window.location.host : ''
  const isSandbox = host.includes('localhost') || host.includes('vercel.app')

  if (isSandbox) {
    return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_SANDBOX || ''
  }

  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
}

interface UpgradesFormProps {
  releaseUuid: string
  distribution: string | null
  creditBalance: Record<string, number>
  paymentSuccess?: boolean
  paymentCanceled?: boolean
  sessionId?: string | null
}

interface Product {
  id: number
  name: string
  description: string | null
  price: number
  priceDisplay: string
  type: string
  icon: string | null
  label: string | null
  isSoloUpgrade: boolean
}

// Lucide icon mapping
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Sparkles,
  Star,
  Crown,
  Rocket,
  Target,
}

// Check if icon is a Font Awesome class
function isFontAwesomeIcon(iconName: string | null): boolean {
  if (!iconName) return false
  const trimmed = iconName.trim()
  return trimmed.startsWith('fa:') || trimmed.startsWith('fa-') || trimmed.startsWith('fab ') || trimmed.startsWith('fas ') || trimmed.startsWith('far ')
}

// Get Font Awesome class (strip "fa:" prefix if present)
function getFontAwesomeClass(iconName: string): string {
  const trimmed = iconName.trim()
  if (trimmed.startsWith('fa:')) {
    return trimmed.slice(3)
  }
  return trimmed
}

function getLucideIconComponent(iconName: string | null) {
  if (!iconName) return Zap
  return ICON_MAP[iconName] || Zap
}

// Icon component that handles both Lucide and Font Awesome
function ProductIcon({ iconName, className }: { iconName: string | null; className?: string }) {
  if (isFontAwesomeIcon(iconName)) {
    const faClass = getFontAwesomeClass(iconName!)
    return <i className={`${faClass} ${className || ''}`} aria-hidden="true" />
  }

  const LucideIcon = getLucideIconComponent(iconName)
  return <LucideIcon className={className} />
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

export function UpgradesForm({
  releaseUuid,
  distribution: initialDistribution,
  creditBalance: initialCreditBalance,
  paymentSuccess: initialPaymentSuccess,
  paymentCanceled,
}: UpgradesFormProps) {
  const router = useRouter()

  // Parse distribution to get purchased product types
  // - 'standard' → default, no upgrades purchased (DB default)
  // - 'yahoo', 'enhanced', etc. → purchased upgrades
  const parseDistribution = (dist: string | null): Set<string> => {
    if (!dist || dist === 'standard') return new Set()
    return new Set(dist.split(',').filter(t => t && t !== 'standard'))
  }

  // Track already purchased products (from initial distribution)
  const [purchasedProducts, setPurchasedProducts] = useState<Set<string>>(
    parseDistribution(initialDistribution)
  )

  // Track newly selected products (cart) - starts empty since purchased items aren't in cart
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [creditBalance, setCreditBalance] = useState<Record<string, number>>(initialCreditBalance)
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(initialPaymentSuccess || false)

  // Stripe payment state
  const [showPayment, setShowPayment] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [stripePromise, setStripePromise] = useState<ReturnType<typeof loadStripe> | null>(null)

  // Initialize Stripe
  useEffect(() => {
    const key = getStripePublishableKey()
    if (key) {
      setStripePromise(loadStripe(key))
    }
  }, [])

  // Check if a solo upgrade is selected (in cart)
  const hasSelectedSoloUpgrade = useMemo(() => {
    return products.some(p => selectedProducts.has(p.type) && p.isSoloUpgrade)
  }, [products, selectedProducts])

  // Check if a solo upgrade has been purchased
  const hasPurchasedSoloUpgrade = useMemo(() => {
    return products.some(p => purchasedProducts.has(p.type) && p.isSoloUpgrade)
  }, [products, purchasedProducts])

  // Check if any non-solo upgrade has been purchased
  const hasPurchasedNonSoloUpgrade = useMemo(() => {
    return products.some(p => purchasedProducts.has(p.type) && !p.isSoloUpgrade)
  }, [products, purchasedProducts])

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return products
      .filter(p => selectedProducts.has(p.type))
      .reduce((sum, p) => sum + p.price, 0)
  }, [products, selectedProducts])

  // Fetch products from API
  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch(`/api/pr/${releaseUuid}/distribution`)
        if (response.ok) {
          const data = await response.json()
          setProducts(data.products || [])
          setCreditBalance(data.creditBalance || {})
          // Update purchased products from API response
          if (data.distribution && data.distribution !== 'standard') {
            setPurchasedProducts(new Set(data.distribution.split(',').filter((t: string) => t && t !== 'standard')))
          }
        }
      } catch (err) {
        console.error('Failed to fetch products:', err)
      } finally {
        setIsFetching(false)
      }
    }
    fetchProducts()
  }, [releaseUuid])

  const toggleProduct = (productType: string) => {
    const product = products.find(p => p.type === productType)
    if (!product) return

    // Don't allow toggling already purchased products
    if (purchasedProducts.has(productType)) return

    // Don't allow adding products if a solo upgrade is already purchased
    if (hasPurchasedSoloUpgrade && !selectedProducts.has(productType)) return

    // Don't allow adding a solo upgrade if non-solo upgrades are already purchased
    if (hasPurchasedNonSoloUpgrade && product.isSoloUpgrade && !selectedProducts.has(productType)) return

    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(productType)) {
        next.delete(productType)
      } else {
        if (product.isSoloUpgrade) {
          // Solo upgrade clears cart and adds only itself
          next.clear()
          next.add(productType)
        } else if (hasSelectedSoloUpgrade) {
          // Adding non-solo when solo is in cart: remove solo, add this
          for (const type of next) {
            const p = products.find(prod => prod.type === type)
            if (p?.isSoloUpgrade) {
              next.delete(type)
            }
          }
          next.add(productType)
        } else {
          next.add(productType)
        }
      }
      return next
    })
  }

  const handleCheckout = async () => {
    if (selectedProducts.size === 0) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/pr/${releaseUuid}/distribution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_payment_intent',
          productTypes: Array.from(selectedProducts)
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

  const handlePaymentSuccess = () => {
    setShowPayment(false)
    setPaymentSuccess(true)
    // Move items from cart to purchased
    setPurchasedProducts(prev => {
      const next = new Set(prev)
      selectedProducts.forEach(type => next.add(type))
      return next
    })
    setSelectedProducts(new Set())
    // Navigate to next step after a short delay
    setTimeout(() => {
      router.push(`/pr/${releaseUuid}/review`)
    }, 1500)
  }

  const handlePaymentCancel = () => {
    setShowPayment(false)
    setClientSecret(null)
    setPaymentIntentId(null)
  }

  const handleContinue = async (): Promise<boolean> => {
    if (selectedProducts.size > 0) {
      await handleCheckout()
      // Return false to prevent WizardActions from navigating - payment form will be shown
      return false
    } else {
      setIsLoading(true)
      try {
        await fetch(`/api/pr/${releaseUuid}/distribution`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'skip' }),
        })
      } catch (err) {
        console.error('Failed to skip upgrades:', err)
      } finally {
        setIsLoading(false)
      }
      // Return true to let WizardActions handle navigation
      return true
    }
  }

  const hasProducts = products.length > 0

  if (isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  // Show payment form
  if (showPayment && clientSecret && stripePromise && paymentIntentId) {
    return (
      <div className="space-y-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    {selectedProducts.size} upgrade{selectedProducts.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-sm text-blue-700">
                    {Array.from(selectedProducts).map(type =>
                      products.find(p => p.type === type)?.name
                    ).join(', ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{formatPrice(cartTotal)}</p>
                <p className="text-xs text-blue-600">total</p>
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
            amount={cartTotal}
            onSuccess={handlePaymentSuccess}
            onCancel={handlePaymentCancel}
            releaseUuid={releaseUuid}
            paymentIntentId={paymentIntentId}
          />
        </Elements>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Payment Status Messages */}
      {paymentSuccess && (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg">
          <Check className="h-5 w-5" />
          <span>Payment successful! Your upgrades have been added to your release.</span>
        </div>
      )}

      {paymentCanceled && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>Payment was canceled. You can try again or skip upgrades.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Notice when solo upgrade prevents adding more */}
      {hasPurchasedSoloUpgrade && (
        <div className="flex items-center gap-2 p-4 bg-amber-50 text-amber-700 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <span>Your purchased upgrade cannot be combined with other upgrades.</span>
        </div>
      )}

      {/* Product Cards */}
      {hasProducts && (
        <>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-blue-800 text-sm">
              Your Newsworthy.ai distribution already includes hundreds of distribution endpoints, full distribution / amplification via Newsramp.com, and SEO / AI optimization. We are pleased to offer the following distribution upgrade options to suit your needs.
            </p>
          </div>
          <div className={cn(
            'grid gap-6',
            products.length === 1 ? 'md:grid-cols-1 max-w-md' : 'md:grid-cols-2'
          )}>
          {products.map((product) => {
            const credits = creditBalance[product.type] || 0
            const hasCredits = credits > 0
            const isPurchased = purchasedProducts.has(product.type)
            const isSelected = selectedProducts.has(product.type)

            // Disable if:
            // 1. Solo upgrade is purchased - can't add anything else
            // 2. Non-solo is purchased and this is a solo - can't combine
            // 3. Solo is in cart and this is not a solo
            const isDisabled = !isSelected && !isPurchased && (
              hasPurchasedSoloUpgrade ||
              (hasPurchasedNonSoloUpgrade && product.isSoloUpgrade) ||
              (hasSelectedSoloUpgrade && !product.isSoloUpgrade)
            )

            return (
              <Card
                key={product.type}
                className={cn(
                  'relative transition-all',
                  isPurchased && 'ring-2 ring-emerald-500 bg-emerald-50',
                  isSelected && !isPurchased && 'ring-2 ring-green-500 bg-green-50',
                  isDisabled && 'opacity-50',
                  product.label && !isSelected && !isPurchased && 'ring-2 ring-blue-500'
                )}
              >
                {isPurchased && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Purchased
                    </span>
                  </div>
                )}
                {isSelected && !isPurchased && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-green-500 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      In Cart
                    </span>
                  </div>
                )}
                {product.label && !isSelected && !isPurchased && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-xs px-3 py-1 rounded-full">
                      {product.label}
                    </span>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      "p-2 rounded-lg flex items-center justify-center w-10 h-10",
                      isPurchased ? "bg-emerald-100" : isSelected ? "bg-green-100" : "bg-blue-100"
                    )}>
                      <ProductIcon iconName={product.icon} className={cn(
                        "h-6 w-6",
                        isPurchased ? "text-emerald-600" : isSelected ? "text-green-600" : "text-blue-600"
                      )} />
                    </div>
                    <div className="text-right">
                      {isPurchased ? (
                        <>
                          <span className="text-2xl font-bold text-emerald-600">Paid</span>
                          <p className="text-xs text-emerald-600">{product.priceDisplay}</p>
                        </>
                      ) : (
                        <>
                          <span className="text-2xl font-bold">{product.priceDisplay}</span>
                          <p className="text-xs text-gray-500">one-time</p>
                        </>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                  {product.description && (
                    <CardDescription dangerouslySetInnerHTML={{ __html: product.description }} />
                  )}
                  {product.isSoloUpgrade && !isPurchased && (
                    <p className="text-xs text-amber-600 mt-1">
                      This upgrade cannot be combined with other upgrades
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {hasCredits && !isPurchased && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Available credits</span>
                        <span className="font-medium">{credits}</span>
                      </div>
                    </div>
                  )}

                  {isPurchased ? (
                    <Button
                      variant="outline"
                      className="w-full border-emerald-200 text-emerald-700 cursor-default"
                      disabled
                    >
                      <Check className="h-4 w-4" />
                      Purchased
                    </Button>
                  ) : (
                    <Button
                      variant={isSelected ? 'outline' : 'default'}
                      className={cn(
                        "w-full",
                        isSelected && "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      )}
                      onClick={() => toggleProduct(product.type)}
                      disabled={isLoading || isDisabled}
                    >
                      {isSelected ? (
                        <>
                          <X className="h-4 w-4" />
                          Remove from Cart
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          Add to Cart
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
        </>
      )}

      {!hasProducts && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-500">No upgrade products are currently available.</p>
          </CardContent>
        </Card>
      )}

      {/* Purchased Summary */}
      {purchasedProducts.size > 0 && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-900">
                    {purchasedProducts.size} upgrade{purchasedProducts.size > 1 ? 's' : ''} purchased
                  </p>
                  <p className="text-sm text-emerald-700">
                    {Array.from(purchasedProducts).map(type =>
                      products.find(p => p.type === type)?.name
                    ).join(', ')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart Summary */}
      {selectedProducts.size > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">
                    {selectedProducts.size} upgrade{selectedProducts.size > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-sm text-blue-700">
                    {Array.from(selectedProducts).map(type =>
                      products.find(p => p.type === type)?.name
                    ).join(', ')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-900">{formatPrice(cartTotal)}</p>
                <p className="text-xs text-blue-600">total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Continue/Checkout section */}
      <WizardActions
        releaseUuid={releaseUuid}
        currentStep={5}
        isLoading={isLoading}
        onSubmit={handleContinue}
        submitLabel={
          selectedProducts.size > 0
            ? `Pay ${formatPrice(cartTotal)}`
            : purchasedProducts.size > 0
              ? "Continue"
              : "Skip Upgrades"
        }
      />
    </div>
  )
}
