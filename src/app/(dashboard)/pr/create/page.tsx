import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, category, region, brandCredits } from '@/db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { PRForm } from '../pr-form'
import { NoCreditsBanner } from './no-credits-banner'

async function getUserCompanies(userId: number) {
  return await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false)
    ),
    with: {
      contacts: true,
    },
  })
}

async function getCategories() {
  return await db.select().from(category).orderBy(category.name)
}

async function getRegions() {
  return await db.select().from(region).orderBy(region.name)
}

interface CreditBalance {
  brandCredits: { companyId: number; balance: number }[]
  userCredits: number
  hasCredits: boolean
}

async function getCreditBalance(userId: number, companyIds: number[]): Promise<CreditBalance> {
  // Get brand-level credits (grouped by company)
  const brandCreditResults = companyIds.length > 0
    ? await db
        .select({
          companyId: brandCredits.companyId,
          balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
        })
        .from(brandCredits)
        .where(
          and(
            isNull(brandCredits.prId), // Only unused credits
            sql`${brandCredits.companyId} IN (${sql.join(companyIds.map(id => sql`${id}`), sql`, `)})`
          )
        )
        .groupBy(brandCredits.companyId)
    : []

  // Get user-level credits (where companyId is null)
  const userCreditResult = await db
    .select({
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as('balance'),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        isNull(brandCredits.companyId), // User-level credits
        isNull(brandCredits.prId) // Only unused credits
      )
    )

  const brandBalances = brandCreditResults
    .filter(r => r.companyId !== null)
    .map(r => ({ companyId: r.companyId!, balance: Number(r.balance) }))

  const userBalance = Number(userCreditResult[0]?.balance || 0)

  // Check if any brand has positive credits or user has positive credits
  const hasPositiveBrandCredits = brandBalances.some(b => b.balance > 0)
  const hasPositiveUserCredits = userBalance > 0

  return {
    brandCredits: brandBalances,
    userCredits: userBalance,
    hasCredits: hasPositiveBrandCredits || hasPositiveUserCredits,
  }
}

export default async function CreatePRPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>
}) {
  const { company: companyUuid } = await searchParams
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const [companies, categories, regions] = await Promise.all([
    getUserCompanies(userId),
    getCategories(),
    getRegions(),
  ])

  if (companies.length === 0) {
    redirect('/company/add?next=/pr/create')
  }

  // Check credit balance
  const companyIds = companies.map(c => c.id)
  const creditBalance = await getCreditBalance(userId, companyIds)

  // Get top-level categories (where parent_category = 'top')
  const topCategories = categories.filter(c => c.parentCategory === 'top')

  // Pre-select company from query param if provided
  const preselectedCompany = companyUuid
    ? companies.find(c => c.uuid === companyUuid)
    : undefined

  // If no credits available, show the purchase credits banner
  if (!creditBalance.hasCredits) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Press Release</h1>
          <p className="text-gray-500">Start a new press release for distribution</p>
        </div>

        <NoCreditsBanner />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Press Release</h1>
        <p className="text-gray-500">Start a new press release for distribution</p>
      </div>

      <PRForm
        companies={companies}
        categories={topCategories}
        topCategories={topCategories}
        regions={regions}
        initialData={preselectedCompany ? { companyId: preselectedCompany.id } : undefined}
      />
    </div>
  )
}
