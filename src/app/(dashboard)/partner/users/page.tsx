import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, releases, partners } from '@/db/schema'
import { eq, and, count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { PartnerUsersList } from './partner-users-list'
import { getManagedPartners, resolvePartnerId } from '../utils'
import { PartnerSelector } from '../partner-selector'

export default async function PartnerUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; partner?: string }>
}) {
  const { q, partner: partnerParam } = await searchParams
  const session = await getEffectiveSession()
  const managedPartnerIds = (session?.user as any)?.managedPartnerIds as number[] | undefined

  if (!managedPartnerIds?.length) {
    redirect('/dashboard')
  }

  const currentPartnerId = resolvePartnerId(managedPartnerIds, partnerParam)
  if (!currentPartnerId) redirect('/dashboard')

  const managedPartners = await getManagedPartners(managedPartnerIds)

  const partner = await db.query.partners.findFirst({
    where: eq(partners.id, currentPartnerId),
  })

  // Get partner users with profiles and release counts
  const partnerUsers = await db
    .select({
      id: users.id,
      email: users.email,
      createdAt: users.createdAt,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      releaseCount: count(releases.id),
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .leftJoin(releases, eq(releases.userId, users.id))
    .where(and(eq(users.partnerId, currentPartnerId), eq(users.isDeleted, false)))
    .groupBy(users.id, users.email, users.createdAt, userProfiles.firstName, userProfiles.lastName)
    .orderBy(users.createdAt)

  // Filter client-side for search (keeps it simple)
  const filtered = q
    ? partnerUsers.filter((u) => {
        const searchLower = q.toLowerCase()
        return (
          u.email.toLowerCase().includes(searchLower) ||
          u.firstName?.toLowerCase().includes(searchLower) ||
          u.lastName?.toLowerCase().includes(searchLower)
        )
      })
    : partnerUsers

  return (
    <div className="space-y-6">
      <div data-tour="partner-users-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {partner?.company || partner?.brandName || 'Partner'} Users
          </h1>
          <p className="text-gray-500">
            {partnerUsers.length} registered user{partnerUsers.length !== 1 ? 's' : ''}
          </p>
        </div>
        <PartnerSelector partners={managedPartners} currentPartnerId={currentPartnerId} />
      </div>

      <PartnerUsersList
        users={filtered}
        searchQuery={q || ''}
        currentPartnerId={managedPartnerIds.length > 1 ? currentPartnerId : undefined}
      />
    </div>
  )
}
