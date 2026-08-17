import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users, userProfiles, company, releases, adminUserFavorites } from '@/db/schema'
import { desc, ilike, eq, and, sql, inArray, gte, lt, or, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Shield, ShieldCheck, User } from 'lucide-react'
import { UserSearchForm } from './search-form'
import { VerifyButton } from './verify-button'
import { SendMessageDialog } from './[id]/send-message-dialog'
import { ActAsButton } from './act-as-button'
import { SyncShareListButton } from './sync-share-list-button'
import { CopyEmailButton } from './copy-email-button'
import { FavoriteUserButton } from './favorite-user-button'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'pending' | 'verified'

/** Cutover for comparing conversion before/after the product change. */
const CONVERSION_CUTOFF = new Date('2026-08-04T00:00:00')

type ConversionPeriod = {
  converted: number
  total: number
  rate: number
}

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

async function getUserIdsByBrand(brandQuery: string): Promise<number[]> {
  const matches = await db
    .select({ userId: company.userId })
    .from(company)
    .where(ilike(company.companyName, `%${brandQuery}%`))
  return [...new Set(matches.map((m) => m.userId))]
}

async function getPeriodConversion(
  registeredSinceCutoff: boolean
): Promise<ConversionPeriod> {
  const periodCondition = registeredSinceCutoff
    ? gte(users.createdAt, CONVERSION_CUTOFF)
    : or(lt(users.createdAt, CONVERSION_CUTOFF), isNull(users.createdAt))

  const [totals] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(and(eq(users.isDeleted, false), periodCondition))

  const [converted] = await db
    .select({ count: sql<number>`count(distinct ${users.id})`.mapWith(Number) })
    .from(users)
    .innerJoin(
      releases,
      and(
        eq(releases.userId, users.id),
        eq(releases.isDeleted, false),
        inArray(releases.status, ['sent', 'approved', 'review']),
      )
    )
    .where(and(eq(users.isDeleted, false), periodCondition))

  const total = totals.count
  const convertedCount = converted.count
  const rate = total > 0 ? (convertedCount / total) * 100 : 0

  return { converted: convertedCount, total, rate }
}

async function getConversionStats() {
  const [sinceAug4, beforeAug4] = await Promise.all([
    getPeriodConversion(true),
    getPeriodConversion(false),
  ])
  return { sinceAug4, beforeAug4 }
}

function formatConversionRate(period: ConversionPeriod): string {
  if (period.total === 0) return '0%'
  return `${period.rate.toFixed(1)}%`
}

async function getReleaseCountsByUser(userIds: number[]): Promise<Map<number, number>> {
  const counts = new Map<number, number>()
  if (userIds.length === 0) return counts

  const rows = await db
    .select({
      userId: releases.userId,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(releases)
    .where(and(
      inArray(releases.userId, userIds),
      eq(releases.isDeleted, false),
      inArray(releases.status, ['sent', 'approved', 'review']),
    ))
    .groupBy(releases.userId)

  for (const row of rows) {
    counts.set(row.userId, row.count)
  }

  return counts
}

async function getFavoriteUserIds(adminUserId: number): Promise<Set<number>> {
  const rows = await db
    .select({ favoritedUserId: adminUserFavorites.favoritedUserId })
    .from(adminUserFavorites)
    .where(eq(adminUserFavorites.adminUserId, adminUserId))

  return new Set(rows.map((r) => r.favoritedUserId))
}

async function getUsers(searchQuery?: string, filter?: FilterType, brandQuery?: string) {
  const conditions = []

  if (searchQuery) {
    conditions.push(ilike(users.email, `%${searchQuery}%`))
  }

  if (brandQuery) {
    const userIds = await getUserIdsByBrand(brandQuery)
    if (userIds.length === 0) {
      return []
    }
    conditions.push(inArray(users.id, userIds))
  }

  if (filter === 'pending') {
    conditions.push(eq(users.emailVerified, false))
  } else if (filter === 'verified') {
    conditions.push(eq(users.emailVerified, true))
  }

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
    })
    .from(users)
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${users.createdAt} DESC NULLS LAST`, desc(users.id))
    .limit(100)
}

async function getCounts(searchQuery?: string, brandQuery?: string) {
  const baseConditions = []

  if (searchQuery) {
    baseConditions.push(ilike(users.email, `%${searchQuery}%`))
  }

  if (brandQuery) {
    const userIds = await getUserIdsByBrand(brandQuery)
    if (userIds.length === 0) {
      return { all: 0, verified: 0, pending: 0 }
    }
    baseConditions.push(inArray(users.id, userIds))
  }

  const baseCondition = baseConditions.length > 0 ? and(...baseConditions) : undefined

  const [allResult] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(baseCondition)

  const [verifiedResult] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(
      baseCondition
        ? and(baseCondition, eq(users.emailVerified, true))
        : eq(users.emailVerified, true)
    )

  const [pendingResult] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(users)
    .where(
      baseCondition
        ? and(baseCondition, eq(users.emailVerified, false))
        : eq(users.emailVerified, false)
    )

  return {
    all: allResult.count,
    verified: verifiedResult.count,
    pending: pendingResult.count,
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; brand?: string }>
}) {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const { q: searchQuery, filter: rawFilter, brand: brandQuery } = await searchParams
  const filter: FilterType = rawFilter === 'pending' || rawFilter === 'verified' ? rawFilter : 'all'
  const adminUserId = session?.user?.id ? Number(session.user.id) : NaN
  const allUsers = await getUsers(searchQuery, filter, brandQuery)
  const [counts, releaseCounts, conversion, favoriteIds] = await Promise.all([
    getCounts(searchQuery, brandQuery),
    getReleaseCountsByUser(allUsers.map((u) => u.id)),
    getConversionStats(),
    isAdmin && Number.isFinite(adminUserId)
      ? getFavoriteUserIds(adminUserId)
      : Promise.resolve(new Set<number>()),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-gray-600 dark:text-gray-400">View and manage all users</p>
        </div>
        {isAdmin && <SyncShareListButton />}
      </div>

      {/* Conversion Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversion Rate · Aug 4 – Present</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatConversionRate(conversion.sinceAug4)}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{conversion.sinceAug4.converted}</span>
              {' of '}
              <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{conversion.sinceAug4.total}</span>
              {' new users with a PR'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Conversion Rate · Pre–Aug 4</p>
            <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {formatConversionRate(conversion.beforeAug4)}
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{conversion.beforeAug4.converted}</span>
              {' of '}
              <span className="tabular-nums font-medium text-gray-900 dark:text-gray-100">{conversion.beforeAug4.total}</span>
              {' users with a PR'}
            </p>
          </CardContent>
        </Card>
      </div>

      <UserSearchForm />

      {/* Filter Tabs */}
      <div data-tour="users-filters" className="flex gap-2">
        <Link
          href={`/admin/users?${new URLSearchParams({ ...(searchQuery ? { q: searchQuery } : {}), ...(brandQuery ? { brand: brandQuery } : {}) }).toString()}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'all' ? 'bg-cyan-800/10 dark:bg-cyan-400/10 text-cyan-800 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
          )}
        >
          All ({counts.all})
        </Link>
        <Link
          href={`/admin/users?${new URLSearchParams({ ...(searchQuery ? { q: searchQuery } : {}), ...(brandQuery ? { brand: brandQuery } : {}), filter: 'pending' }).toString()}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
          )}
        >
          Pending ({counts.pending})
        </Link>
        <Link
          href={`/admin/users?${new URLSearchParams({ ...(searchQuery ? { q: searchQuery } : {}), ...(brandQuery ? { brand: brandQuery } : {}), filter: 'verified' }).toString()}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'verified' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800'
          )}
        >
          Verified ({counts.verified})
        </Link>
      </div>

      {/* Users Table */}
      <Card data-tour="users-table">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead data-tour="users-columns">
                <tr className="border-b text-left">
                  {isAdmin && (
                    <th className="py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400 w-10" />
                  )}
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">ID</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">User</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Verified</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Role</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400 text-right">PR Count</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Created</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Last Login</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user, index) => {
                  const prCount = releaseCounts.get(user.id) ?? 0
                  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
                  return (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 transition-colors" {...(index === 0 ? { "data-tour": "users-first-row" } : {})}>
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
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 text-right tabular-nums">{prCount}</td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatAgo(user.lastSeen ?? user.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2" {...(index === 0 ? { "data-tour": "users-actions" } : {})}>
                        {isAdmin && (
                          <SendMessageDialog
                            userId={user.id}
                            userEmail={user.email}
                          />
                        )}
                        {!user.isAdmin && (
                          <ActAsButton
                            userId={user.id}
                            userEmail={user.email}
                          />
                        )}
                        <Link href={`/admin/users/${user.id}`}>
                          <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100">
                            View
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
