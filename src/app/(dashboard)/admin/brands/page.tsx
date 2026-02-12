import { auth } from '@/lib/auth'
import { db } from '@/db'
import { company, users } from '@/db/schema'
import { desc, ilike, eq, sql } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Building2, ExternalLink, Archive } from 'lucide-react'
import { BrandSearchForm } from './search-form'

async function getBrands(searchQuery?: string) {
  const query = db
    .select({
      id: company.id,
      uuid: company.uuid,
      companyName: company.companyName,
      website: company.website,
      city: company.city,
      state: company.state,
      logoUrl: company.logoUrl,
      isArchived: company.isArchived,
      isDeleted: company.isDeleted,
      userId: company.userId,
      ownerEmail: users.email,
    })
    .from(company)
    .leftJoin(users, eq(company.userId, users.id))
    .orderBy(desc(company.id))
    .limit(200)

  if (searchQuery) {
    return query.where(ilike(company.companyName, `%${searchQuery}%`))
  }

  return query
}

async function getBrandCount(searchQuery?: string) {
  const [result] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(company)
    .where(searchQuery ? ilike(company.companyName, `%${searchQuery}%`) : undefined)

  return result.count
}

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const session = await auth()

  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const { q: searchQuery } = await searchParams
  const brands = await getBrands(searchQuery)
  const totalCount = await getBrandCount(searchQuery)

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
          <h1 className="text-2xl font-bold text-gray-900">Brand Management</h1>
          <p className="text-gray-500">View and manage all brands</p>
        </div>
      </div>

      {/* Brands Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchQuery ? `Search Results (${totalCount})` : `All Brands (${totalCount})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BrandSearchForm />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left">
                  <th className="py-3 px-4 font-medium text-gray-500">ID</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Brand</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Website</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Location</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Owner</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Status</th>
                  <th className="py-3 px-4 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((brand) => (
                  <tr key={brand.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">{brand.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {brand.logoUrl ? (
                          <img
                            src={brand.logoUrl.includes('RESIZE') ? brand.logoUrl.replace('RESIZE', 'resize=width:100') : brand.logoUrl}
                            alt={brand.companyName}
                            className="h-8 w-8 rounded object-contain bg-gray-50"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium">{brand.companyName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {brand.website ? (
                        <a
                          href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {brand.city && brand.state
                        ? `${brand.city}, ${brand.state}`
                        : brand.city || brand.state || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {brand.ownerEmail ? (
                        <Link
                          href={`/admin/users/${brand.userId}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {brand.ownerEmail}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {brand.isDeleted ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                            Deleted
                          </span>
                        ) : brand.isArchived ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                            <Archive className="h-3 w-3" />
                            Archived
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Link href={`/admin/brands/${brand.uuid}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        {!brand.isDeleted && (
                          <Link href={`/company/${brand.uuid}`}>
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {brands.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                      {searchQuery ? 'No brands found matching your search.' : 'No brands found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
