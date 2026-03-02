import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users, releases, partners } from '@/db/schema'
import { count, eq, and, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Users, FileText, Send } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getManagedPartners, resolvePartnerId } from './utils'
import { PartnerSelector } from './partner-selector'

export default async function PartnerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ partner?: string }>
}) {
  const { partner: partnerParam } = await searchParams
  const session = await getEffectiveSession()
  const managedPartnerIds = (session?.user as any)?.managedPartnerIds as number[] | undefined

  if (!managedPartnerIds?.length) {
    redirect('/dashboard')
  }

  const currentPartnerId = resolvePartnerId(managedPartnerIds, partnerParam)
  if (!currentPartnerId) redirect('/dashboard')

  const managedPartners = await getManagedPartners(managedPartnerIds)

  // Get partner info
  const partner = await db.query.partners.findFirst({
    where: eq(partners.id, currentPartnerId),
  })

  // Get partner's users
  const partnerUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.partnerId, currentPartnerId), eq(users.isDeleted, false)))

  const userIds = partnerUsers.map((u) => u.id)
  const totalUsers = userIds.length

  // Get release counts
  let totalReleases = 0
  let totalSent = 0

  if (userIds.length > 0) {
    const [releaseCount] = await db
      .select({ count: count() })
      .from(releases)
      .where(inArray(releases.userId, userIds))
    totalReleases = releaseCount.count

    const [sentCount] = await db
      .select({ count: count() })
      .from(releases)
      .where(and(inArray(releases.userId, userIds), eq(releases.status, 'sent')))
    totalSent = sentCount.count
  }

  const partnerQs = managedPartnerIds.length > 1 ? `?partner=${currentPartnerId}` : ''

  return (
    <div className="space-y-6">
      <div data-tour="partner-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {partner?.company || partner?.brandName || 'Partner'} Dashboard
          </h1>
          <p className="text-gray-500">Overview of your partner account</p>
        </div>
        <PartnerSelector partners={managedPartners} currentPartnerId={currentPartnerId} />
      </div>

      <div data-tour="partner-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
                <p className="text-sm text-gray-500">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalReleases}</p>
                <p className="text-sm text-gray-500">Total Releases</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Send className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalSent}</p>
                <p className="text-sm text-gray-500">Sent Releases</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-tour="partner-actions">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/partner/users${partnerQs}`}>
              <Button variant="outline" className="w-full h-16 flex-col gap-1 cursor-pointer">
                <Users className="h-5 w-5" />
                View Users
              </Button>
            </Link>
            <Link href={`/partner/releases${partnerQs}`}>
              <Button variant="outline" className="w-full h-16 flex-col gap-1 cursor-pointer">
                <FileText className="h-5 w-5" />
                View Press Releases
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
