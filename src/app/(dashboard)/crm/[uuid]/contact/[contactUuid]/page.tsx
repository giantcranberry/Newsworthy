import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { crmContacts } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { CrmContactForm } from './crm-contact-form'

export default async function CrmContactDetailPage({
  params,
}: {
  params: Promise<{ uuid: string; contactUuid: string }>
}) {
  const { uuid, contactUuid } = await params

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()

  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const contact = await db.query.crmContacts.findFirst({
    where: and(
      eq(crmContacts.uuid, contactUuid),
      eq(crmContacts.companyId, co.id),
      sql`${crmContacts.isDeleted} IS NOT TRUE`
    ),
  })

  if (!contact) notFound()

  const enrichment = (contact.pdl as Record<string, unknown>) || null

  return (
    <CrmContactForm
      companyUuid={uuid}
      companyName={co.companyName}
      readOnly={isReadOnly}
      contact={{
        uuid: contact.uuid!,
        contactType: contact.contactType || '',
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        notes: contact.notes || '',
        tld: contact.tld || '',
        publication: contact.publication || '',
        qurl: contact.qurl || '',
        linkedin: contact.linkedin || '',
        twitter: contact.twitter || '',
        facebook: contact.facebook || '',
        instagram: contact.instagram || '',
        crunchbase: contact.crunchbase || '',
        youtube: contact.youtube || '',
        md5: contact.md5 || '',
        emailCount: contact.emailCount || 0,
        unsubscribeAt: contact.unsubscribeAt?.toISOString() || null,
        lastOpenAt: contact.lastOpenAt?.toISOString() || null,
        bouncedAt: contact.bouncedAt?.toISOString() || null,
        createdAt: contact.createdAt?.toISOString() || null,
        updatedAt: contact.updatedAt?.toISOString() || null,
      }}
      enrichment={enrichment}
    />
  )
}
