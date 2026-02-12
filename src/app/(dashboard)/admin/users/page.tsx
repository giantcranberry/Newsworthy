import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { desc, ilike, eq, and, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Shield, ShieldCheck, User } from 'lucide-react'
import { UserSearchForm } from './search-form'
import { VerifyButton } from './verify-button'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'pending' | 'verified'

async function getUsers(searchQuery?: string, filter?: FilterType) {
  const conditions = []

  if (searchQuery) {
    conditions.push(ilike(users.email, `%${searchQuery}%`))
  }

  if (filter === 'pending') {
    conditions.push(eq(users.emailVerified, false))
  } else if (filter === 'verified') {
    conditions.push(eq(users.emailVerified, true))
  }

  return db
    .select()
    .from(users)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(100)
}

async function getCounts(searchQuery?: string) {
  const baseCondition = searchQuery
    ? ilike(users.email, `%${searchQuery}%`)
    : undefined

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
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const session = await auth()

  // Check admin access
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const { q: searchQuery, filter: rawFilter } = await searchParams
  const filter: FilterType = rawFilter === 'pending' || rawFilter === 'verified' ? rawFilter : 'all'
  const allUsers = await getUsers(searchQuery, filter)
  const counts = await getCounts(searchQuery)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-500">View and manage all users</p>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchQuery ? `Search Results` : `User Management`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserSearchForm />

          {/* Filter Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-200">
            {([
              { key: 'all', label: 'All', count: counts.all },
              { key: 'pending', label: 'Pending', count: counts.pending },
              { key: 'verified', label: 'Verified', count: counts.verified },
            ] as const).map((tab) => {
              const href = `/admin/users?${new URLSearchParams({
                ...(searchQuery ? { q: searchQuery } : {}),
                ...(tab.key !== 'all' ? { filter: tab.key } : {}),
              }).toString()}`
              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                    filter === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    'ml-2 rounded-full px-2 py-0.5 text-xs',
                    filter === tab.key
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-500'
                  )}>
                    {tab.count}
                  </span>
                </Link>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="py-3 px-4 font-medium text-gray-500">ID</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Email</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Verified</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Role</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Created</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{user.id}</td>
                    <td className="py-3 px-4 text-sm">{user.email}</td>
                    <td className="py-3 px-4">
                      <VerifyButton userId={user.id} verified={!!user.emailVerified} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {user.isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {user.isEditor && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                            <Shield className="h-3 w-3" />
                            Editor
                          </span>
                        )}
                        {user.isStaff && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700">
                            Staff
                          </span>
                        )}
                        {!user.isAdmin && !user.isEditor && !user.isStaff && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                            <User className="h-3 w-3" />
                            User
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
