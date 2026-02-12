import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { products, userSubscription } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'

async function getProducts() {
  // Get available products
  const availableProducts = await db.query.products.findMany({
    where: eq(products.isActive, true),
  })

  return availableProducts
}

async function getUserCredits(userId: number) {
  const subscription = await db.query.userSubscription.findFirst({
    where: eq(userSubscription.userId, userId),
  })
  return subscription
}

export default async function PaygoPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const [allProducts, credits] = await Promise.all([
    getProducts(),
    getUserCredits(userId),
  ])

  // Group products by type
  const prCredits = allProducts.filter(p => p.productType === 'pr' || p.productType === 'credits')
  const otherProducts = allProducts.filter(p => p.productType !== 'pr' && p.productType !== 'credits')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Buy Credits</h1>
        <p className="text-gray-500">Purchase credits for press releases and other services</p>
      </div>

      {/* Current Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Your Current Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {credits?.remainingPr || 0}
              </p>
              <p className="text-sm text-gray-500">PR Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {credits?.remainingPluspr || 0}
              </p>
              <p className="text-sm text-gray-500">Enhanced Credits</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {credits?.newsdbCredits || 0}
              </p>
              <p className="text-sm text-gray-500">NewsDB Credits</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PR Credit Packages */}
      <div>
        <h2 className="text-lg font-semibold mb-4">PR Credit Packages</h2>
        {prCredits.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-gray-500">
              No PR credit packages available
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {prCredits.map((product) => (
              <Card key={product.id} className="relative">
                {product.isPrimary && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
                      Recommended
                    </span>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{product.displayName || product.shortName}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">
                    ${((product.price || 0) / 100).toFixed(2)}
                  </div>
                  {product.productCredits && (
                    <p className="text-sm text-gray-500 mb-4">
                      {product.productCredits} Credits
                    </p>
                  )}
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Standard distribution
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      News wire syndication
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      Analytics dashboard
                    </li>
                  </ul>
                  <Button className="w-full">
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
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
              <Card key={product.id}>
                <CardHeader>
                  <CardTitle>{product.displayName || product.shortName}</CardTitle>
                  <CardDescription>{product.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-4">
                    ${((product.price || 0) / 100).toFixed(2)}
                  </div>
                  {product.productCredits && (
                    <p className="text-sm text-gray-500 mb-4">
                      {product.productCredits} Credits
                    </p>
                  )}
                  <Button className="w-full">
                    Buy Now
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
