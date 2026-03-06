import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards, communityGuidelines, communityGuidelineAcceptances, company, companyMembers } from '@/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { CommunityHome } from './community-home'

export default async function CommunityPage() {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')

  const [boards, [guidelines], [acceptance]] = await Promise.all([
    db
      .select()
      .from(communityBoards)
      .where(and(eq(communityBoards.isDeleted, false), eq(communityBoards.isArchived, false)))
      .orderBy(asc(communityBoards.sortOrder)),
    db.select().from(communityGuidelines).limit(1),
    db
      .select()
      .from(communityGuidelineAcceptances)
      .where(eq(communityGuidelineAcceptances.userId, userId))
      .limit(1),
  ])

  const guidelinesUpdatedAt = guidelines?.updatedAt ? new Date(guidelines.updatedAt) : null
  const acceptedAt = acceptance?.acceptedAt ? new Date(acceptance.acceptedAt) : null
  const guidelinesAccepted = !!(acceptedAt && guidelinesUpdatedAt && acceptedAt >= guidelinesUpdatedAt)

  // Get user's companies for visibility selector
  const userCompanies = await db
    .select({
      id: company.id,
      companyName: company.companyName,
    })
    .from(companyMembers)
    .innerJoin(company, eq(companyMembers.companyId, company.id))
    .where(eq(companyMembers.userId, userId))

  // Also get companies the user owns directly
  const ownedCompanies = await db
    .select({
      id: company.id,
      companyName: company.companyName,
    })
    .from(company)
    .where(eq(company.userId, userId))

  const allCompanies = [...ownedCompanies, ...userCompanies.filter(uc => !ownedCompanies.some(oc => oc.id === uc.id))]

  const isStaff = !!(
    (session?.user as any)?.isAdmin ||
    (session?.user as any)?.isEditor ||
    (session?.user as any)?.isStaff
  )

  return (
    <CommunityHome
      boards={boards}
      companies={allCompanies}
      currentUserId={userId}
      isAdmin={(session?.user as any)?.isAdmin}
      isStaff={isStaff}
      guidelinesAccepted={guidelinesAccepted}
      guidelinesBody={guidelines?.body || ''}
    />
  )
}
