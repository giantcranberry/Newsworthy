import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, contact } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyForm } from '../company-form'
import { CompanyNav } from '@/components/company/company-nav'
import { RssFeedLink } from '@/components/company/rss-feed-link'

async function getCompany(uuid: string, userId: number, isAdmin: boolean) {
  if (isAdmin) {
    return db.query.company.findFirst({
      where: eq(company.uuid, uuid),
    })
  }
  return db.query.company.findFirst({
    where: and(
      eq(company.uuid, uuid),
      eq(company.userId, userId)
    ),
  })
}

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

  const co = await getCompany(uuid, userId, isAdmin)

  if (!co) {
    notFound()
  }

  const contacts = await getContacts(co.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Brand</h1>
        <p className="text-gray-500">{co.companyName}</p>
        <RssFeedLink companyUuid={co.uuid} />
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <CompanyForm
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
      />
    </div>
  )
}
