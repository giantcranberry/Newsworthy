'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShoppingCart, Loader2, Zap, Sparkles, Star, Crown, Rocket, Target } from 'lucide-react'
import { RedeemCourtesyCode } from '../../dashboard/redeem-courtesy-code'

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
  icon: string | null
  label: string | null
}

type Credits = {
  remainingPr: number | null
  remainingYahoo: number | null
  remainingEnhanced: number | null
  remainingConcierge: number | null
}

/** Strip <hr>, ### end markers, AI citation artifacts, and --- separators from product descriptions. */
function cleanDescription(html: string): string {
  return html
    // Horizontal rules: <hr> with any attributes
    .replace(/<hr[^>]*\/?>/gi, '')
    // HR-like elements: <p>/<div> with border styles acting as visual dividers
    .replace(/<(p|div)[^>]*style="[^"]*border[^"]*"[^>]*>(\s|&nbsp;)*<\/\1>/gi, '')
    // Markdown-style separators: ___, ***, ---
    .replace(/<(p|div)[^>]*>\s*([_*-]{3,})\s*<\/\1>/gi, '')
    // ### end-of-release markers in any wrapper tag, with optional bold/italic
    .replace(/<(p|h[1-6]|div|span)[^>]*>\s*(<(strong|em|b|i)[^>]*>\s*)?#{3,}\s*(<\/(strong|em|b|i)>\s*)?<\/\1>/gi, '')
    // Standalone ### anywhere
    .replace(/#{3,}/g, '')
    // ChatGPT numeric citations: [1], [7], [12]
    .replace(/\s*\[\d+\]/g, '')
    // Gemini-style citations: 【...】
    .replace(/【[^】]*】/g, '')
    // Empty paragraphs left behind after stripping
    .replace(/<(p|div)[^>]*>\s*(&nbsp;|\s)*<\/\1>/gi, '')
    .trim()
}

/** Truncate HTML description to roughly `maxLen` characters, splitting at the nearest tag boundary. */
function truncateHtml(html: string, maxLen = 250): { preview: string; rest: string | null } {
  if (html.length <= maxLen) return { preview: html, rest: null }
  // Find the last closing tag before maxLen
  let splitAt = maxLen
  const chunk = html.substring(0, maxLen + 50)
  // Try to split at the end of a closing tag near maxLen
  const tagEndRegex = /<\/(p|li|ul|ol)>/gi
  let best = -1
  let m: RegExpExecArray | null
  while ((m = tagEndRegex.exec(chunk)) !== null) {
    const end = m.index + m[0].length
    if (end <= maxLen + 50) best = end
    if (end >= maxLen) break
  }
  if (best > maxLen * 0.4) {
    splitAt = best
  }
  const preview = html.substring(0, splitAt).trim()
  const rest = html.substring(splitAt).trim()
  if (rest.length < 20) return { preview: html, rest: null }
  return { preview, rest }
}

export function ProductGrid({
  products,
  credits,
  hasRedeemedCoupon = true,
}: {
  products: Product[]
  credits: Credits | null
  hasRedeemedCoupon?: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [readMoreProduct, setReadMoreProduct] = useState<Product | null>(null)

  const prCredits = products.filter(p => p.productType === 'pr' || p.productType === 'credits')
  const otherProducts = products.filter(p => p.productType !== 'pr' && p.productType !== 'credits')

  const toggleProduct = (id: number) => {
    const product = products.find(p => p.id === id)
    if (!product) return

    setSelected(prev => {
      const next = new Set(prev)

      if (next.has(id)) {
        next.delete(id)
      } else {
        const type = product.productType

        if (type === 'pr' || type === 'credits') {
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
          <div className="flex items-center gap-3">
            <p className="text-gray-500 dark:text-gray-400">Select products to add to your cart</p>
            {!hasRedeemedCoupon && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <RedeemCourtesyCode variant="link" />
              </>
            )}
          </div>
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
                onReadMore={() => setReadMoreProduct(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Other Products */}
      {otherProducts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Enhanced Distribution</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selected.has(product.id)}
                onToggle={() => toggleProduct(product.id)}
                onReadMore={() => setReadMoreProduct(product)}
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

      {/* Read More Dialog */}
      <Dialog open={!!readMoreProduct} onOpenChange={(open) => !open && setReadMoreProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {readMoreProduct && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-1.5 rounded-lg bg-cyan-800/10 dark:bg-cyan-400/10 flex-shrink-0">
                    <ProductIcon iconName={readMoreProduct.icon} className="h-5 w-5 text-cyan-800 dark:text-cyan-400" />
                  </div>
                  <DialogTitle className="text-xl">{readMoreProduct.displayName || readMoreProduct.shortName}</DialogTitle>
                </div>
              </DialogHeader>
              {readMoreProduct.description && (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert [&_ul]:list-disc [&_ul]:pl-4 [&_p]:my-2 [&_hr]:hidden"
                  dangerouslySetInnerHTML={{ __html: cleanDescription(readMoreProduct.description) }}
                />
              )}
              <div className="flex items-center justify-between pt-4 border-t mt-4">
                <div>
                  <div className="text-2xl font-bold">${((readMoreProduct.price || 0) / 100).toFixed(2)}</div>
                  {readMoreProduct.productCredits ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {readMoreProduct.productCredits} {readMoreProduct.productCredits === 1 ? 'Credit' : 'Credits'}
                    </p>
                  ) : null}
                </div>
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

function ProductCard({
  product,
  isSelected,
  disabled,
  onToggle,
  onReadMore,
}: {
  product: Product
  isSelected: boolean
  disabled?: boolean
  onToggle: () => void
  onReadMore: () => void
}) {
  const { preview, rest } = product.description
    ? truncateHtml(cleanDescription(product.description))
    : { preview: null, rest: null }

  return (
    <Card
      className={`relative transition-all flex flex-col ${
        disabled
          ? 'opacity-50 pointer-events-none'
          : isSelected
            ? 'ring-2 ring-cyan-600 bg-cyan-50 dark:bg-cyan-900/30 cursor-pointer'
            : 'hover:shadow-md cursor-pointer'
      }`}
      onClick={disabled ? undefined : onToggle}
    >
      {(product.isPrimary || product.label) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-cyan-800 dark:bg-cyan-600 text-white text-xs px-3 py-1 rounded-full whitespace-nowrap">
            {product.label || 'Recommended'}
          </span>
        </div>
      )}
      <CardHeader className="flex-1">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-800/10 dark:bg-cyan-400/10 flex-shrink-0">
              <ProductIcon iconName={product.icon} className="h-5 w-5 text-cyan-800 dark:text-cyan-400" />
            </div>
            <CardTitle className="text-lg">{product.displayName || product.shortName}</CardTitle>
          </div>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
        </div>
        {preview && (
          <div
            className="text-sm text-gray-500 dark:text-gray-400 prose prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_li]:text-gray-500 dark:[&_li]:text-gray-400 [&_p]:text-gray-500 dark:[&_p]:text-gray-400 [&_p]:my-1 [&_hr]:hidden"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
        {rest && (
          <button
            type="button"
            className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:underline mt-1 text-left"
            onClick={(e) => {
              e.stopPropagation()
              onReadMore()
            }}
          >
            Read More...
          </button>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold mb-2">
          ${((product.price || 0) / 100).toFixed(2)}
        </div>
        {product.productCredits ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {product.productCredits} {product.productCredits === 1 ? 'Credit' : 'Credits'}
          </p>
        ) : null}
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
            onToggle()
          }}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          {isSelected ? 'Remove from Cart' : 'Add to Cart'}
        </Button>
      </CardContent>
    </Card>
  )
}
