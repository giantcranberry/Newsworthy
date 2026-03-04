'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ShoppingCart, Loader2 } from 'lucide-react'

type Product = {
  id: number
  shortName: string | null
  displayName: string | null
  description: string | null
  price: number
  productCredits: number | null
  productType: string | null
  isPrimary: boolean | null
  stripeLivePrice: string | null
  stripeTestPrice: string | null
}

type Credits = {
  remainingPr: number | null
  remainingYahoo: number | null
  remainingEnhanced: number | null
  remainingConcierge: number | null
}

export function ProductGrid({
  products,
  credits,
}: {
  products: Product[]
  credits: Credits | null
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  const prCredits = products.filter(p => p.productType === 'pr' || p.productType === 'credits')
  const otherProducts = products.filter(p => p.productType !== 'pr' && p.productType !== 'credits')

  const toggleProduct = (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    setSelected(prev => {
      const next = new Set(prev)

      if (next.has(id)) {
        // Deselecting - just remove it
        next.delete(id)
      } else {
        // Selecting - enforce mutual exclusivity rules
        const type = product.productType

        if (type === 'pr' || type === 'credits') {
          // PR/credits products are mutually exclusive: deselect other PR/credits
          for (const otherId of next) {
            const other = products.find(p => p.id === otherId)
            if (other && (other.productType === 'pr' || other.productType === 'credits')) {
              next.delete(otherId)
            }
          }
        }

        next.add(id)
      }

      return next
    })
  }

  const selectedProducts = products.filter(p => selected.has(p.id))
  const total = selectedProducts.reduce((sum, p) => sum + (p.price || 0), 0)

  const handleCheckout = async () => {
    if (selected.size === 0) return
    setLoading(true)

    try {
      const res = await fetch('/api/payment/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selected) }),
      })

      const data = await res.json()
      if (data.cartUuid) {
        router.push(`/payment/cart?id=${data.cartUuid}`)
      } else {
        console.error('No cart UUID returned:', data)
        setLoading(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Buy Credits</h1>
          <p className="text-gray-500 dark:text-gray-400">Select products to add to your cart</p>
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="relative flex items-center gap-2 rounded-lg bg-cyan-800 dark:bg-cyan-600 px-4 py-2.5 text-white transition-colors hover:bg-cyan-900 dark:hover:bg-cyan-700 disabled:opacity-50"
          >
            {loading ? (
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

      {/* Current Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Your Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {credits?.remainingPr || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">PR Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {credits?.remainingYahoo || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Yahoo Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {credits?.remainingEnhanced || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Enhanced Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {credits?.remainingConcierge || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Concierge Credits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PR Credit Packages */}
      <div>
        <h2 className="text-lg font-semibold mb-4">PR Credit Packages</h2>
        {prCredits.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
              No PR credit packages available
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prCredits.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selected.has(product.id)}
                onToggle={() => toggleProduct(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Other Products */}
      {otherProducts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Other Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selected.has(product.id)}
                onToggle={() => toggleProduct(product.id)}
              />
            ))}
          </div>
        </div>
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
                  {selectedProducts.map(p => p.displayName || p.shortName).join(', ')}
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
                disabled={loading}
                className="bg-cyan-800 dark:bg-cyan-600 text-white dark:text-white hover:bg-cyan-900 dark:hover:bg-cyan-700 px-8"
                size="lg"
              >
                {loading ? (
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
    </div>
  )
}

function ProductCard({
  product,
  isSelected,
  disabled,
  onToggle,
}: {
  product: Product
  isSelected: boolean
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <Card
      className={`relative transition-all ${
        disabled
          ? 'opacity-50 pointer-events-none'
          : isSelected
            ? 'ring-2 ring-cyan-600 bg-cyan-50 dark:bg-cyan-900/30/30 cursor-pointer'
            : 'hover:shadow-md cursor-pointer'
      }`}
      onClick={disabled ? undefined : onToggle}
    >
      {product.isPrimary && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-cyan-800 dark:bg-cyan-600 text-white text-xs px-3 py-1 rounded-full">
            Recommended
          </span>
        </div>
      )}
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{product.displayName || product.shortName}</CardTitle>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        </div>
        {product.description && (
          <div
            className="text-sm text-gray-500 dark:text-gray-400 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_li]:text-gray-500 dark:text-gray-400 [&_p]:text-gray-500 dark:text-gray-400 [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-2">
          ${((product.price || 0) / 100).toFixed(2)}
        </div>
        {product.productCredits && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {product.productCredits} {product.productCredits === 1 ? 'Credit' : 'Credits'}
          </p>
        )}
        <Button
          variant={isSelected ? 'default' : 'outline'}
          className={`w-full mt-4 ${isSelected ? 'bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
        >
          {isSelected ? 'Remove from Cart' : 'Add to Cart'}
        </Button>
      </CardContent>
    </Card>
  )
}
