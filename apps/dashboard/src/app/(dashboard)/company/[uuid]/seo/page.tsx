import Link from 'next/link'
import { getEffectiveSession } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { getBrandNavState } from '@/lib/brand-setup'
import { SeoForm } from './seo-form'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

export default async function SeoPage({
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SEO/AIO</h1>
        <p className="text-gray-500 dark:text-gray-400">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} {...(await getBrandNavState(co))} />

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-medium text-blue-900">SEO & AI: Get the most out of your news marketing efforts.</p>
        <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
          By completing the <Link href={`/company/${co.uuid}/newsroom`} className="font-medium underline hover:text-blue-950">Newsroom settings</Link> you will have done most of the required work here. This section is optional, however spending some time on this page will boost your SEO and AI visibility. You will get out of it what you put into it.
        </p>
      </div>

      <SeoForm
        readOnly={isReadOnly}
        companyUuid={co.uuid}
        savedSeo={co.seo as Record<string, unknown> | null}
        companyData={{
          companyName: co.companyName,
          nrUri: co.nrUri || '',
          website: co.website || '',
          logoUrl: co.logoUrl || '',
          phone: co.phone || '',
          email: co.email || '',
          addr1: co.addr1 || '',
          addr2: co.addr2 || '',
          city: co.city || '',
          state: co.state || '',
          postalCode: co.postalCode || '',
          countryCode: co.countryCode || '',
          linkedinUrl: co.linkedinUrl || '',
          xUrl: co.xUrl || '',
          youtubeUrl: co.youtubeUrl || '',
          instagramUrl: co.instagramUrl || '',
          blogUrl: co.blogUrl || '',
        }}
      />
    </div>
  )
}
