import { db } from '@/db'
import { partners } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { CoregisterForm } from './coregister-form'

export default async function CoregisterPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params

  const partner = await db.query.partners.findFirst({
    where: and(
      eq(partners.handle, handle),
      eq(partners.isActive, true),
    ),
  })

  if (!partner) {
    notFound()
  }

  return (
    <CoregisterForm
      partnerId={partner.id}
      brandName={partner.brandName}
      logo={partner.logo}
      company={partner.company}
    />
  )
}
