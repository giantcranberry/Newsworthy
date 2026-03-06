import { redirect } from 'next/navigation'
import { auth, getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { DashboardShell } from './dashboard-shell'

async function canUserCreateContent(userId: number): Promise<boolean> {
  // User can create content if they own any company
  const ownedCompany = await db.query.company.findFirst({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
    columns: { id: true },
  })
  if (ownedCompany) return true

  // Or if they have collaborator+ role on any team
  const memberships = await db
    .select({ role: companyMembers.role })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  if (memberships.length === 0) return true // No memberships = new user, allow creating
  return memberships.some((m) => m.role !== 'client')
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const effectiveSession = await getEffectiveSession()
  const userId = parseInt(effectiveSession?.user?.id || '0')
  const canCreate = userId > 0 ? await canUserCreateContent(userId) : true

  return <DashboardShell canCreateContent={canCreate}>{children}</DashboardShell>
}
