import { getEffectiveSession } from "@/lib/auth"
import { db } from "@/db"
import { company, brandCredits, companyMembers } from "@/db/schema"
import { eq, and, isNull, sql, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"
import { ManageCreditsContent } from "./manage-credits-content"

interface CreditsByType {
  pr: number
  yahoo: number
  enhanced: number
  concierge: number
}

interface BrandCreditsBreakdown {
  companyId: number
  companyName: string
  credits: CreditsByType
}

interface AllCredits {
  personal: CreditsByType
  brands: BrandCreditsBreakdown[]
  totalPr: number
}

function sumCredits(rows: { productType: string | null; balance: number }[]): CreditsByType {
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const key = row.productType || 'pr'
    totals[key] = (totals[key] || 0) + Number(row.balance)
  }
  return {
    pr: (totals['pr'] || 0) + (totals['credits'] || 0),
    yahoo: totals['yahoo'] || 0,
    enhanced: totals['enhanced'] || 0,
    concierge: totals['concierge'] || 0,
  }
}

async function getAllCredits(
  userId: number,
  companies: { id: number; companyName: string }[]
): Promise<AllCredits> {
  const userResult = await db
    .select({
      productType: brandCredits.productType,
      balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as("balance"),
    })
    .from(brandCredits)
    .where(
      and(
        eq(brandCredits.userId, userId),
        isNull(brandCredits.companyId),
      ),
    )
    .groupBy(brandCredits.productType)

  const personal = sumCredits(userResult)

  const companyIds = companies.map((c) => c.id)
  const brandResult =
    companyIds.length > 0
      ? await db
          .select({
            companyId: brandCredits.companyId,
            productType: brandCredits.productType,
            balance: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`.as("balance"),
          })
          .from(brandCredits)
          .where(
            sql`${brandCredits.companyId} IN (${sql.join(
              companyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
          .groupBy(brandCredits.companyId, brandCredits.productType)
      : []

  const byCompany = new Map<number, { productType: string | null; balance: number }[]>()
  for (const row of brandResult) {
    if (row.companyId === null) continue
    const list = byCompany.get(row.companyId) || []
    list.push({ productType: row.productType, balance: row.balance })
    byCompany.set(row.companyId, list)
  }

  const brands: BrandCreditsBreakdown[] = []
  for (const co of companies) {
    const rows = byCompany.get(co.id)
    if (!rows) continue
    const credits = sumCredits(rows)
    if (credits.pr > 0 || credits.yahoo > 0 || credits.enhanced > 0 || credits.concierge > 0) {
      brands.push({ companyId: co.id, companyName: co.companyName, credits })
    }
  }

  const totalPr = personal.pr + brands.reduce((sum, b) => sum + b.credits.pr, 0)

  return { personal, brands, totalPr }
}

async function getUserCompanies(userId: number) {
  const ownedCompanies = await db.query.company.findMany({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
  })

  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const ownedIds = new Set(ownedCompanies.map((c) => c.id))
  const sharedIds = memberships.map((m) => m.companyId).filter((id) => !ownedIds.has(id))

  let sharedCompanies: typeof ownedCompanies = []
  if (sharedIds.length > 0) {
    sharedCompanies = await db.query.company.findMany({
      where: and(inArray(company.id, sharedIds), eq(company.isDeleted, false)),
    })
  }

  return [...ownedCompanies, ...sharedCompanies]
}

export default async function ManageCreditsPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || "0")

  if (!userId) {
    redirect("/login")
  }

  const userCompanies = await getUserCompanies(userId)
  const allCredits = await getAllCredits(
    userId,
    userCompanies.map((c) => ({ id: c.id, companyName: c.companyName }))
  )

  const companies = userCompanies.map((c) => ({
    id: c.id,
    companyName: c.companyName,
  }))

  return <ManageCreditsContent allCredits={allCredits} companies={companies} />
}
