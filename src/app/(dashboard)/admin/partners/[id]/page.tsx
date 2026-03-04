import { auth } from '@/lib/auth'
import { db } from '@/db'
import { partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { PartnerForm } from './partner-form'

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    redirect('/dashboard')
  }

  const { id } = await params
  const partnerId = parseInt(id)

  if (isNaN(partnerId)) {
    notFound()
  }

  const partner = await db.query.partners.findFirst({
    where: and(eq(partners.id, partnerId), eq(partners.isDeleted, false)),
  })

  if (!partner) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/partners">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Partners
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {partner.company || partner.brandName || 'Unnamed Partner'}
          </h1>
          {partner.handle && (
            <p className="text-gray-500 dark:text-gray-400">@{partner.handle}</p>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {partner.handle && (
              <p><span className="text-gray-500 dark:text-gray-400">Handle:</span> @{partner.handle}</p>
            )}
            {partner.partnerType && (
              <p><span className="text-gray-500 dark:text-gray-400">Type:</span> {partner.partnerType}</p>
            )}
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Status:</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                partner.isActive
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}>
                {partner.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p><span className="text-gray-500 dark:text-gray-400">Created:</span> {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString() : 'N/A'}</p>
            {partner.publisherUrl && (
              <p>
                <span className="text-gray-500 dark:text-gray-400">Publisher URL:</span>{' '}
                <a href={partner.publisherUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {partner.publisherUrl}
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {partner.contactName && (
              <p><span className="text-gray-500 dark:text-gray-400">Contact:</span> {partner.contactName}</p>
            )}
            {partner.contactEmail && (
              <p><span className="text-gray-500 dark:text-gray-400">Contact Email:</span> {partner.contactEmail}</p>
            )}
            {partner.email && (
              <p><span className="text-gray-500 dark:text-gray-400">Email:</span> {partner.email}</p>
            )}
            {partner.phone && (
              <p><span className="text-gray-500 dark:text-gray-400">Phone:</span> {partner.phone}</p>
            )}
            {(partner.addr1 || partner.addr2 || partner.csz) && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Address:</span>
                {partner.addr1 && <p>{partner.addr1}</p>}
                {partner.addr2 && <p>{partner.addr2}</p>}
                {partner.csz && <p>{partner.csz}</p>}
              </div>
            )}
            {!partner.contactName && !partner.contactEmail && !partner.email && !partner.phone && !partner.addr1 && (
              <p className="text-gray-400">No contact info</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              <span className="text-gray-500 dark:text-gray-400">Base Price:</span>{' '}
              {partner.basePrice !== null ? `$${(partner.basePrice / 100).toFixed(2)}` : 'Not set'}
            </p>
            <p><span className="text-gray-500 dark:text-gray-400">Free PRs:</span> {partner.freePrs ?? 0}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Feed Length:</span> {partner.feedLength ?? 'Not set'}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Backfill:</span> {partner.backfill || 'Not set'}</p>
            <p><span className="text-gray-500 dark:text-gray-400">Include NewsDB:</span> {partner.includeNewsdb ? 'Yes' : 'No'}</p>
          </CardContent>
        </Card>
      </div>

      <PartnerForm partner={partner} />
    </div>
  )
}
