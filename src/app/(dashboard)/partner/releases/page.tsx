import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, releases, userProfiles, partners } from '@/db/schema'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { reportReady } from '@/services/report'
import { PartnerReleasesList } from './partner-releases-list'
import { getManagedPartners, resolvePartnerId } from '../utils'
import { PartnerSelector } from '../partner-selector'

const PER_PAGE = 20

export default async function PartnerReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; user?: string; status?: string; partner?: string }>
}) {
  const { page: pageParam, user: userParam, status: statusParam, partner: partnerParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam || '1'))
  const userFilter = userParam ? parseInt(userParam) : null
  const statusFilter = statusParam || null

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

  // Get partner's users for dropdown filter
  const partnerUsers = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(eq(users.partnerId, currentPartnerId), eq(users.isDeleted, false)))

  const userIds = partnerUsers.map((u) => u.id)

  if (userIds.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {partner?.company || partner?.brandName || 'Partner'} Press Releases
            </h1>
            <p className="text-gray-500">No users registered under this partner yet.</p>
          </div>
          <PartnerSelector partners={managedPartners} currentPartnerId={currentPartnerId} />
        </div>
      </div>
    )
  }

  // Build query conditions
  const conditions = [
    userFilter ? eq(releases.userId, userFilter) : inArray(releases.userId, userIds),
    ...(statusFilter ? [eq(releases.status, statusFilter)] : []),
  ]

  const allReleases = await db.query.releases.findMany({
    where: and(...conditions),
    orderBy: desc(releases.createdAt),
    with: {
      company: true,
      owner: {
        with: { profile: true },
      },
    },
  })

  const total = allReleases.length
  const totalPages = Math.ceil(total / PER_PAGE)
  const paginated = allReleases.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const releasesData = paginated.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
    releasedAt: r.releasedAt,
    companyName: r.company?.companyName || null,
    userName: r.owner?.profile?.firstName
      ? `${r.owner.profile.firstName} ${r.owner.profile.lastName || ''}`.trim()
      : r.owner?.email || '—',
    userId: r.userId,
    reportReady: reportReady(r.releasedAt),
  }))

  const userOptions = partnerUsers.map((u) => ({
    id: u.id,
    label: u.firstName
      ? `${u.firstName} ${u.lastName || ''}`.trim()
      : u.email,
  }))

  return (
    <div className="space-y-6">
      <div data-tour="partner-releases-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {partner?.company || partner?.brandName || 'Partner'} Press Releases
          </h1>
          <p className="text-gray-500">
            {total} release{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <PartnerSelector partners={managedPartners} currentPartnerId={currentPartnerId} />
      </div>

      <PartnerReleasesList
        releases={releasesData}
        users={userOptions}
        currentUser={userFilter}
        currentStatus={statusFilter}
        page={page}
        totalPages={totalPages}
        currentPartnerId={managedPartnerIds.length > 1 ? currentPartnerId : undefined}
      />
    </div>
  )
}
