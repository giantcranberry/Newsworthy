import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { desc, ilike, eq, and, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Admin
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600">View and manage all users</p>
      </div>

      <UserSearchForm />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        <Link
          href={`/admin/users${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'all' ? 'bg-cyan-800/10 text-cyan-800' : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          All ({counts.all})
        </Link>
        <Link
          href={`/admin/users?${new URLSearchParams({ ...(searchQuery ? { q: searchQuery } : {}), filter: 'pending' }).toString()}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          Pending ({counts.pending})
        </Link>
        <Link
          href={`/admin/users?${new URLSearchParams({ ...(searchQuery ? { q: searchQuery } : {}), filter: 'verified' }).toString()}`}
          className={cn(
            'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors',
            filter === 'verified' ? 'bg-green-100 text-green-800' : 'text-gray-700 hover:bg-gray-100'
          )}
        >
          Verified ({counts.verified})
        </Link>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">ID</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Verified</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Created</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-600">{user.id}</td>
                    <td className="py-3 px-4 text-sm font-medium text-gray-900">{user.email}</td>
                    <td className="py-3 px-4">
                      <VerifyButton userId={user.id} verified={!!user.emailVerified} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {user.isAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        {user.isEditor && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            <Shield className="h-3 w-3" />
                            Editor
                          </span>
                        )}
                        {user.isStaff && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                            Staff
                          </span>
                        )}
                        {!user.isAdmin && !user.isEditor && !user.isStaff && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            <User className="h-3 w-3" />
                            User
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <Link href={`/admin/users/${user.id}`}>
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 cursor-pointer transition-colors hover:bg-gray-100 hover:text-gray-900">
                          View
                        </button>
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
