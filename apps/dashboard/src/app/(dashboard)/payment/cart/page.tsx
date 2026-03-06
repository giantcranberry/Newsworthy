import { redirect } from 'next/navigation'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { carts, products, company, companyMembers, users } from '@/db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { CartReview } from './cart-review'

async function getCartItems(cartUuid: string, userId: number) {
  const cartItems = await db
    .select()
    .from(carts)
    .where(
      and(
        eq(carts.cartUuid, cartUuid),
        eq(carts.userId, userId),
        isNull(carts.paidAt),
      ),
    )

  // Enrich with product details
  const enriched = await Promise.all(
    cartItems.map(async (item) => {
      const product = item.productId
        ? await db.query.products.findFirst({
            where: eq(products.id, item.productId),
          })
        : null
      return {
        id: item.id,
        productId: item.productId,
        productName: product?.displayName || product?.shortName || 'Product',
        productDescription: product?.description || null,
        productType: item.productType,
        productCredits: item.productCredits,
        price: product?.price || 0,
        stripePrice: item.stripePrice,
      }
    }),
  )

  return enriched
}

async function getUserCompanies(userId: number) {
  // Owned companies
  const owned = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
  })

  // Team companies where user is brand_admin (can purchase credits)
  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(and(
      eq(companyMembers.userId, userId),
      eq(companyMembers.role, 'brand_admin'),
    ))

  const ownedIds = new Set(owned.map((c) => c.id))
  const sharedIds = memberships.map((m) => m.companyId).filter((id) => !ownedIds.has(id))

  let shared: typeof owned = []
  if (sharedIds.length > 0) {
    shared = await db.query.company.findMany({
      where: and(inArray(company.id, sharedIds), eq(company.isDeleted, false)),
    })
  }

  return [...owned, ...shared]
}

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const params = await searchParams
  const cartUuid = params.id

  if (!cartUuid) {
    redirect('/payment/paygo')
  }

  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    redirect('/login')
  }

  const userId = parseInt(session.user.id)

  const [items, companies, user] = await Promise.all([
    getCartItems(cartUuid, userId),
    getUserCompanies(userId),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ])

  const isAgency = user?.isAgency ?? false

  if (items.length === 0) {
    redirect('/payment/paygo')
  }

  const total = items.reduce((sum, item) => sum + item.price, 0)

  return (
    <CartReview
      cartUuid={cartUuid}
      items={items}
      companies={companies.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        logoUrl: c.logoUrl,
      }))}
      total={total}
      userEmail={session.user.email || ''}
      isAgency={isAgency}
    />
  )
}
