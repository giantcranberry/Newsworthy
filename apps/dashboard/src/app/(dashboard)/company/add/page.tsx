import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { companyMembers } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { CompanyForm } from '../company-form'
import { CompanyNav } from '@/components/company/company-nav'

export default async function AddCompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  // Check if user has any team memberships
  const membership = await db.query.companyMembers.findFirst({
    where: eq(companyMembers.userId, userId),
    columns: { id: true },
  })

  // Only allow same-app relative redirects (single leading slash)
  const nextUrl = next && /^\/(?!\/)/.test(next) ? next : undefined

  return (
    <CompanyForm
      notice={membership ? 'This brand will be created under your personal account and will not be shared with any teams you belong to.' : undefined}
      nextUrl={nextUrl}
      headerExtra={
        <CompanyNav companyUuid="" companyName="" disabled setupMode />
      }
    />
  )
}
