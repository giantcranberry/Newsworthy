import { getEffectiveSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { NewsroomForm } from './newsroom-form'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

export default async function NewsroomPage({
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Newsroom Settings</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <NewsroomForm
        readOnly={isReadOnly}
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
          facebookUrl: co.facebookUrl || '',
          tiktokUrl: co.tiktokUrl || '',
          podcastFeedUrl: co.podcastFeedUrl || '',
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
