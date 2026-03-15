import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { products, brandCredits } from '@/db/schema'
import { eq, and, or, isNull, ne, asc, desc, sql, SQL } from 'drizzle-orm'
import { ProductGrid } from './product-grid'

async function getProducts(partnerId: number) {
  return db
    .select()
    .from(products)
    .where(and(
      eq(products.isActive, true),
      eq(products.isDeleted, false),
      ne(products.productType, 'newsdb'),
      ne(products.productType, 'addon'),
      or(
        eq(products.partnerId, partnerId),
        isNull(products.partnerId)
      )
    ))
    .orderBy(
      sql`${products.partnerId} IS NULL ASC`,
      asc(products.sortOrder),
      desc(products.isPrimary),
      asc(products.shortName)
    )
}

async function getUserCredits(userId: number) {
  const result = await db
    .select({
      prCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} IN ('pr', 'credits') THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      yahooCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'yahoo' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      enhancedCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'enhanced' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
      conciergeCredits: sql<number>`COALESCE(SUM(CASE WHEN ${brandCredits.productType} = 'concierge' THEN ${brandCredits.credits} ELSE 0 END), 0)`,
    })
    .from(brandCredits)
    .where(eq(brandCredits.userId, userId))

  return {
    remainingPr: Number(result[0]?.prCredits || 0),
    remainingYahoo: Number(result[0]?.yahooCredits || 0),
    remainingEnhanced: Number(result[0]?.enhancedCredits || 0),
    remainingConcierge: Number(result[0]?.conciergeCredits || 0),
  }
}

export default async function PaygoPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const userPartnerId = (session?.user as any)?.partnerId || 1

  const [allProducts, credits] = await Promise.all([
    getProducts(userPartnerId),
    getUserCredits(userId),
  ])

  return (
    <ProductGrid
      products={allProducts.map(p => ({
        id: p.id,
        shortName: p.shortName,
        displayName: p.displayName,
        description: p.description,
        price: p.price,
        productCredits: p.productCredits,
        productType: p.productType,
        isPrimary: p.isPrimary,
        stripeLivePrice: p.stripeLivePrice,
        stripeTestPrice: p.stripeTestPrice,
        icon: p.icon,
        label: p.label,
      }))}
      credits={credits}
    />
  )
}
