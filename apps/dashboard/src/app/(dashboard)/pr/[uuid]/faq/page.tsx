import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseFaqs, releaseOptions, releaseImages } from '@/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { FaqForm } from './faq-form'
import { WizardNav } from '@/components/pr-wizard/wizard-nav'
import { getUserCompanyIds } from '@/lib/team-auth'

async function getReleaseWithFaqs(uuid: string) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
    with: {
      company: true,
      primaryImage: true,
      banner: true,
      faqs: {
        orderBy: [asc(releaseFaqs.sortOrder)],
      },
      releaseImages: {
        orderBy: [asc(releaseImages.sortOrder)],
        with: { image: true },
      },
    },
  })

  return release
}

async function getReleaseOptions(prId: number) {
  return await db.query.releaseOptions.findFirst({
    where: eq(releaseOptions.prId, prId),
  })
}

export default async function FaqPage({
  params,
}: {
  params: Promise<{ uuid: string }>
}) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')

  const release = await getReleaseWithFaqs(uuid)

  if (!release) {
    notFound()
  }

  // Check access: owner or team member
  if (release.userId !== userId) {
    const companyIds = await getUserCompanyIds(userId)
    if (!companyIds.includes(release.companyId)) {
      notFound()
    }
  }

  const options = release.id ? await getReleaseOptions(release.id) : null

  const releaseWithFaqCount = {
    ...release,
    faqCount: release.faqs.length,
  }

  return (
    <FaqForm
      releaseUuid={uuid}
      existingFaqs={release.faqs.map(f => ({ question: f.question, answer: f.answer }))}
      releaseTitle={release.title || ''}
    >
      <WizardNav
        releaseUuid={uuid}
        currentStep={3}
        release={releaseWithFaqCount}
        company={release.company || undefined}
        releaseOptions={options || undefined}
      />
    </FaqForm>
  )
}
