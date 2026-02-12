import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { NewsroomForm } from './newsroom-form'

async function getCompany(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

export default async function NewsroomPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params

  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff

  const co = await getCompany(uuid, userId, isAdmin)
  if (!co) notFound()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Newsroom Settings</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <NewsroomForm
        companyUuid={co.uuid}
        initialData={{
          nrUri: co.nrUri || '',
          nrTitle: co.nrTitle || '',
          nrDesc: co.nrDesc || '',
          website: co.website || '',
          linkedinUrl: co.linkedinUrl || '',
          xUrl: co.xUrl || '',
          youtubeUrl: co.youtubeUrl || '',
          instagramUrl: co.instagramUrl || '',
          blogUrl: co.blogUrl || '',
          googleDriveUrl: co.googleDriveUrl || '',
          dropboxUrl: co.dropboxUrl || '',
          boxUrl: co.boxUrl || '',
          agencyName: co.agencyName || '',
          agencyWebsite: co.agencyWebsite || '',
          agencyContactName: co.agencyContactName || '',
          agencyContactPhone: co.agencyContactPhone || '',
          agencyContactEmail: co.agencyContactEmail || '',
          gmb: co.gmb || '',
        }}
      />
    </div>
  )
}
