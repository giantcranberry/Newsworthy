import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CompanyNav } from '@/components/company/company-nav'
import { SeoForm } from './seo-form'

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

export default async function SeoPage({
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
        <h1 className="text-2xl font-bold text-gray-900">SEO/AIO</h1>
        <p className="text-gray-500">{co.companyName}</p>
      </div>

      <CompanyNav companyUuid={co.uuid} companyName={co.companyName} />

      <SeoForm
        companyUuid={co.uuid}
        savedJsonLd={co.jsonLd as Record<string, unknown> | null}
        savedSeo={co.seo as Record<string, unknown> | null}
        companyData={{
          companyName: co.companyName,
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
