import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { CrmImportForm } from './crm-import-form'

async function getUserCompanies(userId: number) {
  const owned = await db.query.company.findMany({
    where: and(
      eq(company.userId, userId),
      eq(company.isDeleted, false),
      eq(company.isArchived, false),
    ),
    orderBy: desc(company.id),
  })

  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  const ownedIds = new Set(owned.map((c) => c.id))
  const sharedIds = memberships
    .map((m) => m.companyId)
    .filter((id) => !ownedIds.has(id))

  let shared: typeof owned = []
  if (sharedIds.length > 0) {
    shared = await db.query.company.findMany({
      where: and(
        inArray(company.id, sharedIds),
        eq(company.isDeleted, false),
        eq(company.isArchived, false),
      ),
      orderBy: desc(company.id),
    })
  }

  return [...owned, ...shared]
}

export default async function CrmImportPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const companies = await getUserCompanies(userId)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Contacts</h1>
        <p className="text-gray-500 dark:text-gray-400">Import contacts from CSV or Excel files</p>
      </div>

      <CrmImportForm
        companies={companies.map((co) => ({
          uuid: co.uuid!,
          companyName: co.companyName,
        }))}
      />
    </div>
  )
}
