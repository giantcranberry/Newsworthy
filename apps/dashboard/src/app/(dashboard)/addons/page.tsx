import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AddonsForm } from './addons-form'

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

export default async function AddonsPage() {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    redirect('/login')
  }

  const userId = parseInt(session.user.id)
  const userCompanies = await getUserCompanies(userId)

  const companies = userCompanies.map((c) => ({
    id: c.id,
    name: c.companyName,
  }))

  return (
    <div className="py-8 px-4 md:px-8">
      <AddonsForm companies={companies} />
    </div>
  )
}
