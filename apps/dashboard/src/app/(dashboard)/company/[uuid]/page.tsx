import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyForm } from '../company-form'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { RssFeedLink } from '@/components/company/rss-feed-link'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    notFound()
  }

  const co = access.company

  // Check if the owner is an agency user
  const owner = await db.query.users.findFirst({
    where: eq(users.id, co.userId),
    columns: { isAgency: true },
  })
  const isAgency = !!owner?.isAgency
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  return (
    <CompanyForm
      readOnly={isReadOnly}
      initialData={{
        uuid: co.uuid,
        companyName: co.companyName,
        website: co.website || '',
        addr1: co.addr1 || '',
        addr2: co.addr2 || '',
        city: co.city || '',
        state: co.state || '',
        postalCode: co.postalCode || '',
        countryCode: co.countryCode || 'US',
        phone: co.phone || '',
        email: co.email || '',
      }}
      isAgency={isAgency}
      headerExtra={
        <>
          <RssFeedLink companyUuid={co.uuid} />
          <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />
        </>
      }
    />
  )
}
