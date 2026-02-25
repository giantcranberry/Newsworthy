import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contact, users } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyForm } from '../company-form'
import { CompanyNav } from '@/components/company/company-nav'
import { RssFeedLink } from '@/components/company/rss-feed-link'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

async function getContacts(companyId: number) {
  return db
    .select()
    .from(contact)
    .where(and(
      eq(contact.companyId, companyId),
      sql`${contact.isDeleted} IS NOT TRUE`
    ))
}

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
  const contacts = await getContacts(co.id)

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
        logoUrl: co.logoUrl || '',
        addr1: co.addr1 || '',
        addr2: co.addr2 || '',
        city: co.city || '',
        state: co.state || '',
        postalCode: co.postalCode || '',
        countryCode: co.countryCode || 'US',
        phone: co.phone || '',
        email: co.email || '',
      }}
      contacts={contacts.map((c) => ({
        uuid: c.uuid || '',
        name: c.name,
        title: c.title || '',
        email: c.email || '',
        phone: c.phone || '',
      }))}
      isAgency={isAgency}
      headerExtra={
        <>
          <RssFeedLink companyUuid={co.uuid} />
          <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />
        </>
      }
    />
  )
}
