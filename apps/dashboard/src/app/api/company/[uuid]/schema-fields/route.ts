import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { buildJsonLd } from '@/lib/build-json-ld'

// Allowlisted fields that can be updated via this endpoint
const ALLOWED_FIELDS = [
  'website', 'logoUrl', 'phone', 'email',
  'addr1', 'city', 'state', 'postalCode', 'countryCode',
  'linkedinUrl', 'xUrl', 'youtubeUrl', 'instagramUrl', 'blogUrl',
] as const

type AllowedField = typeof ALLOWED_FIELDS[number]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  if (!hasMinRole(access.role, 'collaborator')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const co = access.company
  const body = await request.json()

  // Filter to only allowed fields
  const updateData: Record<string, string> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body && typeof body[key] === 'string') {
      updateData[key] = body[key]
    }
  }

  // Also handle seo.aio updates
  let seoUpdate: Record<string, unknown> | null = null
  if (body.companySummary !== undefined || body.preferredName !== undefined) {
    const existingSeo = (co.seo as Record<string, any>) || {}
    const existingAio = existingSeo.aio || {}
    seoUpdate = {
      ...existingSeo,
      aio: {
        ...existingAio,
        ...(body.companySummary !== undefined ? { companySummary: body.companySummary } : {}),
        ...(body.preferredName !== undefined ? { preferredName: body.preferredName } : {}),
      },
    }
  }

  if (Object.keys(updateData).length === 0 && !seoUpdate) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Merge with existing company data to rebuild jsonLd
  const mergedCompanyData = {
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
    // Apply the new values on top
    ...updateData,
  }

  const jsonLd = buildJsonLd(mergedCompanyData)

  const dbUpdate: Record<string, unknown> = {
    ...updateData,
    jsonLd,
  }
  if (seoUpdate) {
    dbUpdate.seo = seoUpdate
  }

  await db.update(company)
    .set(dbUpdate)
    .where(eq(company.id, co.id))

  return NextResponse.json({ success: true, updatedFields: Object.keys(updateData) })
}
