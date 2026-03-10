import { auth } from '@/lib/auth'
import { db } from '@/db'
import { company, contact, users, releases, companyMembers } from '@/db/schema'
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
    with: {
      profile: true,
    },
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

async function getTeamMembers(companyId: number) {
  return db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
    with: {
      user: {
        with: {
          profile: true,
        },
      },
    },
  })
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

  const [owner, contacts, brandReleases, teamMembers] = await Promise.all([
    getBrandOwner(brand.userId),
    getBrandContacts(brand.id),
    getBrandReleases(brand.id),
    getTeamMembers(brand.id),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Link href="/admin/brands" className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 dark:text-gray-100 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to Brands
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {brand.logoUrl ? (
              <img
                src={brand.logoUrl.includes('RESIZE') ? brand.logoUrl.replace('RESIZE', 'resize=width:200/output=format:png') : brand.logoUrl}
                alt={brand.companyName}
                className="h-20 w-20 rounded-lg object-contain bg-gray-50 dark:bg-gray-950"
              />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-gray-400" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{brand.companyName}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Brand ID: {brand.id}</p>
            </div>
          </div>
          {!brand.isDeleted && (
            <Link href={`/company/${brand.uuid}`}>
              <Button className="gap-2 bg-cyan-800 dark:bg-cyan-600 hover:bg-cyan-900 dark:hover:bg-cyan-700 text-white">
                <Pencil className="h-4 w-4" />
                Edit Brand
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Brand Details */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
              {brand.isDeleted ? (
                <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                  Deleted
                </span>
              ) : brand.isArchived ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Archive className="h-3 w-3" />
                  Archived
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                  Active
                </span>
              )}
            </div>

            {/* Contact Info */}
            {(brand.website || brand.email || brand.phone) && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Contact</p>
                {brand.website && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-gray-400" /> Website
                    </span>
                    <a
                      href={brand.website.startsWith('http') ? brand.website : `https://${brand.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                    >
                      {brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {brand.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-gray-400" /> Email
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{brand.email}</span>
                  </div>
                )}
                {brand.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-gray-400" /> Phone
                    </span>
                    <span className="text-sm text-gray-900 dark:text-gray-100">{brand.phone}</span>
                  </div>
                )}
              </div>
            )}

            {/* Location */}
            {(brand.addr1 || brand.city) && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Location</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-gray-400" /> Address
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 text-right">
                    {[brand.addr1, brand.addr2].filter(Boolean).join(', ')}
                    {brand.addr1 && <br />}
                    {[brand.city, brand.state, brand.postalCode].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>
            )}

            {/* Online Presence */}
            {(brand.nrUri || brand.linkedinUrl || brand.xUrl) && (
              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Online Presence</p>
                {brand.nrUri && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Newsroom URI</span>
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">{brand.nrUri}</span>
                  </div>
                )}
                {brand.linkedinUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">LinkedIn</span>
                    <a
                      href={brand.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                    >
                      Profile <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {brand.xUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">X / Twitter</span>
                    <a
                      href={brand.xUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-400 flex items-center gap-1"
                    >
                      Profile <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column: Owner, Contacts, Releases */}
        <div className="space-y-6">
          {/* Owner Info */}
          <Card>
            <CardContent className="py-4">
              {owner ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                      <User className="h-4 w-4 text-cyan-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {owner.profile?.firstName || owner.profile?.lastName
                          ? [owner.profile.firstName, owner.profile.lastName].filter(Boolean).join(' ')
                          : owner.email}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {owner.profile?.firstName || owner.profile?.lastName ? owner.email : `Owner \u00b7 ID ${owner.id}`}
                      </p>
                    </div>
                  </div>
                  <Link href={`/admin/users/${owner.id}`}>
                    <Button size="sm" className="bg-gray-600 hover:bg-gray-700 text-white">
                      View User Profile
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">Owner not found</p>
              )}
            </CardContent>
          </Card>

          {/* Team Members */}
          {teamMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Team Members ({teamMembers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {teamMembers.map((member) => {
                    const name = member.user.profile?.firstName || member.user.profile?.lastName
                      ? [member.user.profile.firstName, member.user.profile.lastName].filter(Boolean).join(' ')
                      : null
                    const roleLabel = member.role === 'brand_admin' ? 'Brand Admin'
                      : member.role === 'collaborator' ? 'Collaborator'
                      : member.role === 'client' ? 'Client'
                      : member.role
                    const roleColor = member.role === 'brand_admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                      : member.role === 'client' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700'

                    return (
                      <div key={member.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                            <User className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {name || member.user.email}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                              {name ? member.user.email : `ID ${member.user.id}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleColor}`}>
                            {roleLabel}
                          </span>
                          <Link href={`/admin/users/${member.user.id}`}>
                            <Button variant="outline" size="sm" className="text-xs">
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contacts */}
          <Card>
            <CardHeader>
              <CardTitle>PR Contacts ({contacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {contacts.map((c) => (
                    <div key={c.id} className="py-2.5 first:pt-0 last:pb-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</p>
                      {c.title && <p className="text-xs text-gray-600 dark:text-gray-400">{c.title}</p>}
                      <div className="flex gap-4 mt-0.5">
                        {c.email && <span className="text-xs text-gray-600 dark:text-gray-400">{c.email}</span>}
                        {c.phone && <span className="text-xs text-gray-600 dark:text-gray-400">{c.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No contacts</p>
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
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {brandReleases.map((r) => (
                    <div key={r.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {r.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
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
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No releases</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
