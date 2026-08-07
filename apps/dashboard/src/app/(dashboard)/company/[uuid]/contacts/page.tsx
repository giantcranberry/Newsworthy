import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contact } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { ContactsForm } from './contacts-form'
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

export default async function ContactsPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const access = await getCompanyAccess(uuid, userId, isAdmin)
  if (!access) notFound()
  const co = access.company
  const isReadOnly = !hasMinRole(access.role, 'brand_admin')

  const contacts = await getContacts(co.id)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">PR Contacts</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
        <p className="text-sm text-gray-400 mt-1">These are the contacts that can be added to your press releases for media inquiries. Journalists will use this information to reach out for interviews, quotes, and follow-up questions.</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />

      <ContactsForm
        readOnly={isReadOnly}
        companyUuid={co.uuid}
        contacts={contacts.map((c) => ({
          uuid: c.uuid || '',
          name: c.name,
          title: c.title || '',
          email: c.email || '',
          phone: c.phone || '',
          avatar: c.avatar || '',
        }))}
      />
    </div>
  )
}
