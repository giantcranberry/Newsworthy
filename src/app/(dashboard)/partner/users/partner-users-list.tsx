'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Search, Users } from 'lucide-react'

interface PartnerUser {
  id: number
  email: string
  createdAt: Date | null
  firstName: string | null
  lastName: string | null
  releaseCount: number
}

export function PartnerUsersList({
  users,
  searchQuery,
  currentPartnerId,
}: {
  users: PartnerUser[]
  searchQuery: string
  currentPartnerId?: number
}) {
  const router = useRouter()
  const [search, setSearch] = useState(searchQuery)

  const buildUrl = (path: string, extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (currentPartnerId) params.set('partner', currentPartnerId.toString())
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if (v) params.set(k, v)
      }
    }
    const qs = params.toString()
    return `${path}${qs ? `?${qs}` : ''}`
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    router.push(buildUrl('/partner/users', value ? { q: value } : {}))
  }

  if (users.length === 0 && !searchQuery) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No Users Yet</h3>
          <p className="mt-2 text-gray-600">No users have registered under this partner yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-gray-500">No users match your search.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Releases
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                    {user.firstName || user.lastName
                      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {user.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    {user.releaseCount > 0 ? (
                      <Link
                        href={buildUrl('/partner/releases', { user: user.id.toString() })}
                        className="text-cyan-700 hover:text-cyan-900 font-medium"
                      >
                        {user.releaseCount}
                      </Link>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
