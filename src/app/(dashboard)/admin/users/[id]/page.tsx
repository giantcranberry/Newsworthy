import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, userSubscription, releases, staffNotes, brandCredits, company, partners, partnerManagers } from '@/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { UserDetailForm } from './user-detail-form'
import { ImpersonateButton } from './impersonate-button'
import { SendMessageDialog } from './send-message-dialog'
import { StaffNotesCard } from './staff-notes-card'

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

  const accountCreditsResult = await db
    .select({ total: sql<number>`COALESCE(SUM(${brandCredits.credits}), 0)` })
    .from(brandCredits)
    .where(and(
      eq(brandCredits.userId, userId),
      eq(brandCredits.productType, 'pr'),
      sql`${brandCredits.companyId} IS NULL`
    ))
  const accountCredits = Number(accountCreditsResult[0]?.total) || 0

  const creditHistory = await db
    .select()
    .from(brandCredits)
    .where(and(
      eq(brandCredits.userId, userId),
      eq(brandCredits.productType, 'pr')
    ))
    .orderBy(desc(brandCredits.createdAt))
    .limit(50)

  const companyIds = creditHistory
    .filter(c => c.companyId !== null)
    .map(c => c.companyId as number)

  let companies: Record<number, string> = {}
  if (companyIds.length > 0) {
    const companyList = await db
      .select({ id: company.id, name: company.companyName })
      .from(company)
      .where(sql`${company.id} IN ${companyIds}`)
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

  return {
    user,
    recentReleases,
    notes,
    accountCredits,
    creditHistory,
    companies,
    allPartners,
    managedPartnerIds,
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

  const { user, recentReleases, notes, accountCredits, creditHistory, companies, allPartners, managedPartnerIds } = data

  return (
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
            <h1 className="text-2xl font-bold text-gray-900">
              {user.profile?.firstName} {user.profile?.lastName}
            </h1>
            <p className="text-gray-500">
              <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
                {user.email}
              </a>
              {' '}<span className="text-gray-400">|</span>{' '}
              ID: {user.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="text-gray-500">Joined:</span> {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
            {user.lastSeen && (
              <p><span className="text-gray-500">Last Seen:</span> {new Date(user.lastSeen).toLocaleDateString()}</p>
            )}
            {user.loginCount && (
              <p><span className="text-gray-500">Login Count:</span> {user.loginCount}</p>
            )}
            <div className="flex flex-wrap gap-1 pt-2">
              {user.isAdmin && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">Admin</span>}
              {user.isEditor && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Editor</span>}
              {user.isStaff && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">Staff</span>}
              {user.emailVerified && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Verified</span>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="text-gray-500">Account Credits:</span> <strong>{accountCredits.toLocaleString()}</strong></p>
            <p><span className="text-gray-500">PR Credits:</span> {user.subscription?.remainingPr || 0}</p>
            <p><span className="text-gray-500">Enhanced:</span> {user.subscription?.remainingPluspr || 0}</p>
            <p><span className="text-gray-500">NewsDB:</span> {user.subscription?.newsdbCredits || 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Press Releases</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {recentReleases.length === 0 ? (
              <p className="text-gray-500">No published releases</p>
            ) : (
              <ul className="space-y-2">
                {recentReleases.map((pr) => (
                  <li key={pr.id}>
                    <Link href={`/pr/${pr.uuid}`} className="text-blue-600 hover:underline">
                      {pr.title || 'Untitled'}
                    </Link>
                    <p className="text-xs text-gray-500">
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
          canResetPassword={isAdmin || isEditor}
        />

        <StaffNotesCard notes={notes} userId={user.id} />
      </div>
    </div>
  )
}
