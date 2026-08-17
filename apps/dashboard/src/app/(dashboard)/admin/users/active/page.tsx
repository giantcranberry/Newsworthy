import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, releases, adminUserFavorites } from '@/db/schema'
import { desc, eq, and, sql, gte, or, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Shield, ShieldCheck, User, Activity } from 'lucide-react'
import { VerifyButton } from '../verify-button'
import { SendMessageDialog } from '../[id]/send-message-dialog'
import { ActAsButton } from '../act-as-button'
import { CopyEmailButton } from '../copy-email-button'
import { FavoriteUserButton } from '../favorite-user-button'

function formatAgo(date: Date | null | undefined): string {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

function thirtyDaysAgo(): Date {
  const d = new Date()
  d.setDate(d.getDate() - 30)
  d.setHours(0, 0, 0, 0)
  return d
}

async function getMostActiveUsers(since: Date) {
  const sentInWindow = and(
    eq(releases.status, 'sent'),
    eq(releases.isDeleted, false),
    or(
      gte(releases.releasedAt, since),
      and(isNull(releases.releasedAt), gte(releases.releaseAt, since))
    )
  )

  return db
    .select({
      id: users.id,
      email: users.email,
      emailVerified: users.emailVerified,
      isAdmin: users.isAdmin,
      isEditor: users.isEditor,
      isStaff: users.isStaff,
      createdAt: users.createdAt,
      lastSeen: users.lastSeen,
      firstName: userProfiles.firstName,
      lastName: userProfiles.lastName,
      phone: userProfiles.phone,
      sentCount: sql<number>`count(${releases.id})`.mapWith(Number),
    })
    .from(users)
    .innerJoin(releases, and(eq(releases.userId, users.id), sentInWindow))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(and(eq(users.isDeleted, false), eq(users.isAdmin, false)))
    .groupBy(
      users.id,
      users.email,
      users.emailVerified,
      users.isAdmin,
      users.isEditor,
      users.isStaff,
      users.createdAt,
      users.lastSeen,
      userProfiles.firstName,
      userProfiles.lastName,
      userProfiles.phone
    )
    .having(sql`count(${releases.id}) > 1`)
    .orderBy(desc(sql`count(${releases.id})`), desc(users.id))
    .limit(100)
}

async function getFavoriteUserIds(adminUserId: number): Promise<Set<number>> {
  const rows = await db
    .select({ favoritedUserId: adminUserFavorites.favoritedUserId })
    .from(adminUserFavorites)
    .where(eq(adminUserFavorites.adminUserId, adminUserId))

  return new Set(rows.map((r) => r.favoritedUserId))
}

export default async function MostActiveUsersPage() {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const since = thirtyDaysAgo()
  const adminUserId = session?.user?.id ? Number(session.user.id) : NaN
  const [activeUsers, favoriteIds] = await Promise.all([
    getMostActiveUsers(since),
    isAdmin && Number.isFinite(adminUserId)
      ? getFavoriteUserIds(adminUserId)
      : Promise.resolve(new Set<number>()),
  ])

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            Most Active Users
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Ranked by sent press releases in the last 30 days (2+)
            <span className="text-gray-400"> · since {since.toLocaleDateString()}</span>
          </p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          All users
        </Link>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 w-12">
                    #
                  </th>
                  {isAdmin && (
                    <th className="py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400 w-10" />
                  )}
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">ID</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">User</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Verified</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">
                    Sent (30d)
                  </th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Created</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={isAdmin ? 10 : 9}
                      className="py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No users with more than one sent press release in the last 30 days
                    </td>
                  </tr>
                ) : (
                  activeUsers.map((user, index) => {
                    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
                    return (
                      <tr
                        key={user.id}
                        className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm tabular-nums text-gray-400">{index + 1}</td>
                        {isAdmin && (
                          <td className="py-3 px-2">
                            <FavoriteUserButton
                              userId={user.id}
                              favorited={favoriteIds.has(user.id)}
                            />
                          </td>
                        )}
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">{user.id}</td>
                        <td className="py-3 px-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {fullName || '—'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                              {user.phone || '—'}
                            </p>
                            <p className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                              {user.email}
                              <CopyEmailButton email={user.email} />
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <VerifyButton userId={user.id} verified={!!user.emailVerified} />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            {user.isAdmin && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                                <ShieldCheck className="h-3 w-3" />
                                Admin
                              </span>
                            )}
                            {user.isEditor && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                                <Shield className="h-3 w-3" />
                                Editor
                              </span>
                            )}
                            {user.isStaff && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-700 dark:text-purple-400">
                                Staff
                              </span>
                            )}
                            {!user.isAdmin && !user.isEditor && !user.isStaff && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                                <User className="h-3 w-3" />
                                User
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-violet-700 dark:text-violet-300 text-right tabular-nums">
                          {user.sentCount}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatAgo(user.lastSeen ?? user.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {isAdmin && (
                              <SendMessageDialog userId={user.id} userEmail={user.email} />
                            )}
                            {!user.isAdmin && (
                              <ActAsButton userId={user.id} userEmail={user.email} />
                            )}
                            <Link href={`/admin/users/${user.id}`}>
                              <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100">
                                View
                              </button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
