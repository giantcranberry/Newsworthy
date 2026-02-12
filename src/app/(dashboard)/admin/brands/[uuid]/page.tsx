import { auth } from '@/lib/auth'
import { db } from '@/db'
import { company, contact, users, releases } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Pencil,
  User,
  FileText,
  Archive,
  Globe,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'

async function getBrand(uuid: string) {
  return db.query.company.findFirst({
    where: eq(company.uuid, uuid),
  })
}

async function getBrandOwner(userId: number) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
  })
}

async function getBrandContacts(companyId: number) {
  return db
    .select()
    .from(contact)
    .where(
      and(
        eq(contact.companyId, companyId),
        sql`${contact.isDeleted} IS NOT TRUE`
      )
    )
}

async function getBrandReleases(companyId: number) {
  return db
    .select({
      id: releases.id,
      uuid: releases.uuid,
      title: releases.title,
      status: releases.status,
      createdAt: releases.createdAt,
    })
    .from(releases)
    .where(eq(releases.companyId, companyId))
    .orderBy(desc(releases.createdAt))
    .limit(10)
}

export default async function AdminBrandDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await auth()

  const isAdmin = !!(session?.user as any)?.isAdmin
  const isStaff = !!(session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const brand = await getBrand(uuid)

  if (!brand) {
    notFound()
  }

  const [owner, contacts, brandReleases] = await Promise.all([
    getBrandOwner(brand.userId),
    getBrandContacts(brand.id),
    getBrandReleases(brand.id),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/brands">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl.includes('RESIZE') ? brand.logoUrl.replace('RESIZE', 'resize=width:100') : brand.logoUrl}
                alt={brand.companyName}
                className="h-10 w-10 rounded object-contain bg-gray-50"
              />
            ) : (
              <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-gray-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{brand.companyName}</h1>
              <p className="text-gray-500">Brand ID: {brand.id}</p>
            </div>
          </div>
        </div>
        {!brand.isDeleted && (
          <Link href={`/company/${brand.uuid}`}>
            <Button className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit Brand
            </Button>
          </Link>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand Details */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
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

            {brand.website && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Website
                </span>
                <a
                  href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {brand.email && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </span>
                <span className="text-sm">{brand.email}</span>
              </div>
            )}

            {brand.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </span>
                <span className="text-sm">{brand.phone}</span>
              </div>
            )}

            {(brand.addr1 || brand.city) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Address
                </span>
                <span className="text-sm text-right">
                  {[brand.addr1, brand.addr2].filter(Boolean).join(', ')}
                  {brand.addr1 && <br />}
                  {[brand.city, brand.state, brand.postalCode].filter(Boolean).join(', ')}
                </span>
              </div>
            )}

            {brand.nrUri && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Newsroom URI</span>
                <span className="text-sm font-mono text-gray-700">{brand.nrUri}</span>
              </div>
            )}

            {brand.linkedinUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">LinkedIn</span>
                <a
                  href={brand.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  Profile <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {brand.xUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">X / Twitter</span>
                <a
                  href={brand.xUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  Profile <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Owner Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-400" />
              Owner
            </CardTitle>
          </CardHeader>
          <CardContent>
            {owner ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Email</span>
                  <span className="text-sm">{owner.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">User ID</span>
                  <span className="text-sm">{owner.id}</span>
                </div>
                <Link href={`/admin/users/${owner.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    View User Profile
                  </Button>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Owner not found</p>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader>
            <CardTitle>Media Contacts ({contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {contacts.map((c) => (
                  <div key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                    <div className="flex gap-4 mt-0.5">
                      {c.email && <span className="text-xs text-gray-500">{c.email}</span>}
                      {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No contacts</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Releases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-400" />
              Recent Releases ({brandReleases.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {brandReleases.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {brandReleases.map((r) => (
                  <div key={r.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        {r.status}
                      </span>
                      <Link href={`/pr/${r.uuid}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">No releases</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
