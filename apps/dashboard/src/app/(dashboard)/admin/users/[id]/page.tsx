import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userSubscription, releases, staffNotes, brandCredits, company, partners, partnerManagers, companyMembers } from '@/db/schema'
import { eq, desc, and, sql, or, inArray } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { UserDetailForm } from './user-detail-form'
import { ImpersonateButton } from './impersonate-button'
import { SendMessageDialog } from './send-message-dialog'
import { StaffNotesCard } from './staff-notes-card'
import { DeleteUserButton } from './delete-user-button'
import { UserInvoicesCard } from './user-invoices-card'
import { LifetimeSpendDetailsRow, LifetimeSpendProvider } from './lifetime-spend'

async function getUserData(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      profile: true,
      subscription: true,
    },
  })

  if (!user) return null

  const recentReleases = await db.query.releases.findMany({
    where: and(
      eq(releases.userId, userId),
      eq(releases.status, 'sent')
    ),
    orderBy: desc(releases.createdAt),
    limit: 5,
    with: {
      company: true,
    },
  })

  const notes = await db
    .select()
    .from(staffNotes)
    .where(eq(staffNotes.userId, userId))
    .orderBy(desc(staffNotes.createdAt))

  const creditsByType = await db
    .select({
      productType: brandCredits.productType,
      total: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`,
    })
    .from(brandCredits)
    .where(eq(brandCredits.userId, userId))
    .groupBy(brandCredits.productType)

  const creditTotals: Record<string, number> = {}
  for (const row of creditsByType) {
    creditTotals[row.productType || 'pr'] = Number(row.total) || 0
  }
  const accountCredits = creditTotals['pr'] || 0

  const creditHistory = await db
    .select()
    .from(brandCredits)
    .where(and(
      eq(brandCredits.userId, userId),
      eq(brandCredits.productType, 'pr')
    ))
    .orderBy(desc(brandCredits.createdAt))
    .limit(50)

  // Podcast PR credits are always assigned to a specific brand, so show the
  // per-brand balance rather than just the account-wide sum.
  const podcastCreditsByBrand = await db
    .select({
      companyId: brandCredits.companyId,
      total: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)`,
    })
    .from(brandCredits)
    .where(and(
      eq(brandCredits.userId, userId),
      eq(brandCredits.productType, 'podcast_pr')
    ))
    .groupBy(brandCredits.companyId)

  const companyIds = [
    ...creditHistory.filter(c => c.companyId !== null).map(c => c.companyId as number),
    ...podcastCreditsByBrand.filter(c => c.companyId !== null).map(c => c.companyId as number),
  ]

  let companies: Record<number, string> = {}
  if (companyIds.length > 0) {
    const companyList = await db
      .select({ id: company.id, name: company.companyName })
      .from(company)
      .where(inArray(company.id, companyIds))
    companies = Object.fromEntries(companyList.map(c => [c.id, c.name]))
  }

  const allPartners = await db
    .select()
    .from(partners)
    .where(eq(partners.isDeleted, false))
    .orderBy(partners.handle)

  const managedRows = await db
    .select({ partnerId: partnerManagers.partnerId })
    .from(partnerManagers)
    .where(eq(partnerManagers.userId, userId))
  const managedPartnerIds = managedRows.map(r => r.partnerId)

  // Brands this user has access to (owned + team membership). Used to assign
  // podcast_pr credits to a specific brand.
  const memberRows = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))
  const memberCompanyIds = memberRows.map(r => r.companyId)

  const userBrandRows = await db
    .select({ id: company.id, name: company.companyName, isDeleted: company.isDeleted, isArchived: company.isArchived })
    .from(company)
    .where(
      memberCompanyIds.length > 0
        ? or(eq(company.userId, userId), inArray(company.id, memberCompanyIds))
        : eq(company.userId, userId),
    )
    .orderBy(company.companyName)
  // Drop deleted / archived brands. Done in JS to handle null defaults
  // safely — pre-existing rows may have NULL rather than false.
  const userBrands = userBrandRows
    .filter((b) => b.isDeleted !== true && b.isArchived !== true)
    .map((b) => ({ id: b.id, name: b.name }))

  return {
    user,
    recentReleases,
    notes,
    accountCredits,
    creditTotals,
    creditHistory,
    podcastCreditsByBrand,
    companies,
    allPartners,
    managedPartnerIds,
    userBrands,
  }
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isEditor = (session?.user as any)?.isEditor
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const { id } = await params
  const userId = parseInt(id)

  if (isNaN(userId)) {
    notFound()
  }

  const data = await getUserData(userId)

  if (!data) {
    notFound()
  }

  const { user, recentReleases, notes, accountCredits, creditTotals, creditHistory, podcastCreditsByBrand, companies, allPartners, managedPartnerIds, userBrands } = data
  // created_at is null for many older/recent signups (column has no DB default);
  // fall back to subscription start which is set at registration.
  const registeredAt = user.createdAt ?? user.subscription?.startAt ?? null

  return (
    <LifetimeSpendProvider
      initialCents={typeof user.profile?.lifetimeSpend === 'number' ? user.profile.lifetimeSpend : null}
      initialUpdatedAt={user.profile?.lifetimeSpendUpdatedAt ?? null}
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Users
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {user.profile?.firstName} {user.profile?.lastName}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              <a href={`mailto:${user.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                {user.email}
              </a>
              {' '}<span className="text-gray-400">|</span>{' '}
              ID: {user.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !user.isAdmin && !user.isSuper && (
            <DeleteUserButton
              userId={user.id}
              userEmail={user.email}
              userName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : undefined}
            />
          )}
          {isAdmin && (
            <SendMessageDialog
              userId={user.id}
              userEmail={user.email}
              userName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : undefined}
            />
          )}
          {isAdmin && !user.isAdmin && (
            <ImpersonateButton userId={user.id} userEmail={user.email} />
          )}
          {!isAdmin && (isEditor || isStaff) && !user.isAdmin && !user.isEditor && !user.isStaff && (
            <ImpersonateButton userId={user.id} userEmail={user.email} />
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="text-gray-500 dark:text-gray-400">Registered since:</span> {registeredAt ? new Date(registeredAt).toLocaleDateString() : 'N/A'}</p>
            {user.lastSeen && (
              <p><span className="text-gray-500 dark:text-gray-400">Last Seen:</span> {new Date(user.lastSeen).toLocaleDateString()}</p>
            )}
            {user.loginCount && (
              <p><span className="text-gray-500 dark:text-gray-400">Login Count:</span> {user.loginCount}</p>
            )}
            <LifetimeSpendDetailsRow />
            <div className="flex flex-wrap gap-1 pt-2">
              {user.isAdmin && <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs">Admin</span>}
              {user.isEditor && <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs">Editor</span>}
              {user.isStaff && <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded text-xs">Staff</span>}
              {user.emailVerified && <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded text-xs">Verified</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="text-gray-500 dark:text-gray-400">PR Credits:</span> <strong>{(creditTotals['pr'] || 0).toLocaleString()}</strong></p>
            <p><span className="text-gray-500 dark:text-gray-400">Yahoo:</span> <strong>{(creditTotals['yahoo'] || 0).toLocaleString()}</strong></p>
            <p><span className="text-gray-500 dark:text-gray-400">Enhanced:</span> <strong>{(creditTotals['enhanced'] || 0).toLocaleString()}</strong></p>
            <p><span className="text-gray-500 dark:text-gray-400">Podcast PR:</span> <strong>{(creditTotals['podcast_pr'] || 0).toLocaleString()}</strong></p>
            {podcastCreditsByBrand.length > 0 && (
              <div className="pt-1 space-y-1">
                {podcastCreditsByBrand.map((row) => (
                  <p key={row.companyId ?? 'account'} className="text-xs text-gray-500 dark:text-gray-400 pl-3">
                    {row.companyId ? (companies[row.companyId] || `Brand #${row.companyId}`) : 'Unassigned'}:{' '}
                    <span className="font-medium text-gray-700 dark:text-gray-300">{Number(row.total).toLocaleString()}</span>
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Press Releases</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {recentReleases.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No published releases</p>
            ) : (
              <ul className="space-y-2">
                {recentReleases.map((pr) => (
                  <li key={pr.id}>
                    <Link href={`/editorial/edit/${pr.id}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                      {pr.title || 'Untitled'}
                    </Link>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {pr.releasedAt && new Date(pr.releasedAt).toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <UserDetailForm
          user={user}
          allPartners={allPartners}
          managedPartnerIds={managedPartnerIds}
          accountCredits={accountCredits}
          creditHistory={creditHistory}
          companies={companies}
          userBrands={userBrands}
          canResetPassword={isAdmin || isEditor}
        />

        <div className="space-y-6">
          <UserInvoicesCard
            userId={user.id}
            userEmail={user.email}
            userName={user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : undefined}
            userBrands={userBrands}
          />
          <StaffNotesCard notes={notes} userId={user.id} />
        </div>
      </div>
    </div>
    </LifetimeSpendProvider>
  )
}
