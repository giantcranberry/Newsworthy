import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { companyMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { CompanyForm } from '../company-form'
import { CompanyNav } from '@/components/company/company-nav'

export default async function AddCompanyPage() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  // Check if user has any team memberships
  const membership = await db.query.companyMembers.findFirst({
    where: eq(companyMembers.userId, userId),
    columns: { id: true },
  })

  return (
    <CompanyForm
      notice={membership ? 'This brand will be created under your personal account and will not be shared with any teams you belong to.' : undefined}
      headerExtra={
        <CompanyNav companyUuid="" companyName="" disabled />
      }
    />
  )
}
