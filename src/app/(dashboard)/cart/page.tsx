import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { cartSessions, cartItems } from '@/db/schema'
import { eq, and, isNull } from 'drizzle-orm'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Trash2, ArrowRight } from 'lucide-react'

async function getActiveCart(userId: number) {
  // Get active cart session
  const activeSession = await db.query.cartSessions.findFirst({
    where: and(
      eq(cartSessions.userId, userId),
      eq(cartSessions.status, 'draft'),
      isNull(cartSessions.completedAt)
    ),
  })

  if (!activeSession) return null

  // Get cart items
  const items = await db.query.cartItems.findMany({
    where: and(
      eq(cartItems.sessionId, activeSession.id),
      isNull(cartItems.removedAt)
    ),
  })

  return { session: activeSession, items }
}

export default async function CartPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const cart = await getActiveCart(userId)

  if (!cart || cart.items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
          <p className="text-gray-500">Review your items before checkout</p>
        </div>

        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Your cart is empty</h3>
            <p className="mt-2 text-gray-500">Add some products to get started</p>
            <div className="mt-6">
              <Link href="/payment/paygo">
                <Button>
                  Browse Products
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { session: cartSession, items } = cart

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopping Cart</h1>
        <p className="text-gray-500">Review your items before checkout</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.productName}</h3>
                    <p className="text-sm text-gray-500">
                      {item.productType} {item.productCredits && `- ${item.productCredits} credits`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-medium">
                        ${(item.totalPrice / 100).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Qty: {item.quantity}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>${(cartSession.subtotal / 100).toFixed(2)}</span>
              </div>
              {cartSession.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>${(cartSession.taxAmount / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-4 flex justify-between font-medium">
                <span>Total</span>
                <span>${(cartSession.totalAmount / 100).toFixed(2)}</span>
              </div>
              <Button className="w-full" size="lg">
                Checkout
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-gray-500 text-center">
                Secure checkout powered by Stripe
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
