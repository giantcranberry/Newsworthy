import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityBoards, communityGuidelines, communityGuidelineAcceptances, company, companyMembers } from '@/db/schema'
import { and, eq } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BoardView } from './board-view'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) redirect('/login')

  const { slug } = await params

  const [board] = await db
    .select()
    .from(communityBoards)
    .where(and(eq(communityBoards.slug, slug), eq(communityBoards.isDeleted, false)))
    .limit(1)

  if (!board) notFound()

  const isStaff = !!(
    (session?.user as any)?.isAdmin ||
    (session?.user as any)?.isEditor ||
    (session?.user as any)?.isStaff
  )

  // Get all active boards for the post form selector
  const allBoards = await db
    .select({ id: communityBoards.id, name: communityBoards.name, slug: communityBoards.slug, color: communityBoards.color, staffOnly: communityBoards.staffOnly })
    .from(communityBoards)
    .where(and(eq(communityBoards.isDeleted, false), eq(communityBoards.isArchived, false)))

  // Get user's companies
  const userCompanies = await db
    .select({ id: company.id, companyName: company.companyName })
    .from(companyMembers)
    .innerJoin(company, eq(companyMembers.companyId, company.id))
    .where(eq(companyMembers.userId, userId))

  const ownedCompanies = await db
    .select({ id: company.id, companyName: company.companyName })
    .from(company)
    .where(eq(company.userId, userId))

  const allCompanies = [...ownedCompanies, ...userCompanies.filter(uc => !ownedCompanies.some(oc => oc.id === uc.id))]

  // Check guidelines acceptance
  const [[guidelines], [acceptance]] = await Promise.all([
    db.select().from(communityGuidelines).limit(1),
    db.select().from(communityGuidelineAcceptances).where(eq(communityGuidelineAcceptances.userId, userId)).limit(1),
  ])

  const guidelinesUpdatedAt = guidelines?.updatedAt ? new Date(guidelines.updatedAt) : null
  const acceptedAt = acceptance?.acceptedAt ? new Date(acceptance.acceptedAt) : null
  const guidelinesAccepted = !!(acceptedAt && guidelinesUpdatedAt && acceptedAt >= guidelinesUpdatedAt)

  return (
    <div className="space-y-6">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Community
      </Link>

      <BoardView
        board={board}
        allBoards={allBoards}
        companies={allCompanies}
        currentUserId={userId}
        isAdmin={(session?.user as any)?.isAdmin}
        isStaff={isStaff}
        guidelinesAccepted={guidelinesAccepted}
        guidelinesBody={guidelines?.body || ''}
      />
    </div>
  )
}
