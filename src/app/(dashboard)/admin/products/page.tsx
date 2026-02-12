import { auth } from '@/lib/auth'
import { db } from '@/db'
import { products, partners } from '@/db/schema'
import { eq, and, desc, isNull, or } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { ProductList } from './product-list'

async function getPartners() {
  return db
    .select({
      id: partners.id,
      company: partners.company,
      handle: partners.handle,
    })
    .from(partners)
    .where(eq(partners.isDeleted, false))
    .orderBy(partners.company)
}

async function getProducts(partnerId: number | null) {
  // Base conditions: not deleted and active
  const baseConditions = and(
    eq(products.isDeleted, false),
    eq(products.isActive, true)
  )

  if (partnerId === null) {
    // Show products available to all accounts (partnerId is null)
    return db
      .select()
      .from(products)
      .where(and(baseConditions, isNull(products.partnerId)))
      .orderBy(desc(products.createdAt))
  } else if (partnerId === -1) {
    // Show all products (no filter)
    return db
      .select()
      .from(products)
      .where(baseConditions)
      .orderBy(desc(products.createdAt))
  } else {
    // Show products for specific partner
    return db
      .select()
      .from(products)
      .where(and(baseConditions, eq(products.partnerId, partnerId)))
      .orderBy(desc(products.createdAt))
  }
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ partner?: string }>
}) {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const { partner } = await searchParams

  // Parse partner filter: undefined/-1 = all, 'all' = null partnerId (available to all accounts), number = specific partner
  let partnerFilter: number | null = -1 // default: show all
  if (partner === 'global') {
    partnerFilter = null // products available to all accounts
  } else if (partner && partner !== 'all') {
    partnerFilter = parseInt(partner)
    if (isNaN(partnerFilter)) partnerFilter = -1
  }

  const [partnerList, productList] = await Promise.all([
    getPartners(),
    getProducts(partnerFilter),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upgrade Products</h1>
        <p className="text-gray-500">Manage press release upgrade products</p>
      </div>

      <ProductList
        products={productList}
        partners={partnerList}
        currentFilter={partner || 'all'}
      />
    </div>
  )
}
