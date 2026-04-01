import { redirect } from 'next/navigation'
import Script from 'next/script'
import { auth, getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, companyMembers } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { DashboardShell } from './dashboard-shell'

const GOOGLE_ADS_ID = 'AW-18056538801'

async function canUserCreateContent(userId: number): Promise<boolean> {
  // User can create content if they own any company
  const ownedCompany = await db.query.company.findFirst({
    where: and(eq(company.userId, userId), eq(company.isDeleted, false)),
    columns: { id: true },
  })
  if (ownedCompany) return true

  // Or if they have collaborator+ role on any team
  const memberships = await db
    .select({ role: companyMembers.role })
    .from(companyMembers)
    .where(eq(companyMembers.userId, userId))

  if (memberships.length === 0) return true // No memberships = new user, allow creating
  return memberships.some((m) => m.role !== 'client')
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  const effectiveSession = await getEffectiveSession()
  const userId = parseInt(effectiveSession?.user?.id || '0')
  const canCreate = userId > 0 ? await canUserCreateContent(userId) : true

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script
        id="google-ads-dashboard"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `,
        }}
      />
      <DashboardShell canCreateContent={canCreate}>{children}</DashboardShell>
    </>
  )
}
