import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getPostHog } from '@/lib/posthog'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'
import { generateUniqueNrUri } from '@/lib/newsroom-slug'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const {
      companyName,
      website,
      logoUrl,
      addr1,
      addr2,
      city,
      state,
      postalCode,
      countryCode,
      phone,
      email,
      linkedinUrl,
      xUrl,
      youtubeUrl,
      instagramUrl,
    } = body

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const uuid = uuidv4()
    const nrUri = await generateUniqueNrUri(companyName)

    // Create company
    const [newCompany] = await db.insert(company).values({
      uuid,
      userId,
      companyName,
      website,
      logoUrl,
      addr1,
      addr2,
      city,
      state,
      postalCode,
      countryCode,
      phone,
      email,
      linkedinUrl,
      xUrl,
      youtubeUrl,
      instagramUrl,
      nrUri,
    }).returning()

    getPostHog().capture({
      distinctId: String(userId),
      event: 'company_created',
      properties: {
        company_id: newCompany.id,
        company_uuid: newCompany.uuid,
        company_name: companyName,
        has_website: !!website,
        has_logo: !!logoUrl,
        country_code: countryCode || null,
      },
    })

    return NextResponse.json({ uuid: newCompany.uuid, id: newCompany.id })
  } catch (error) {
    console.error('Error creating company:', error)
    getPostHog().captureException(error, String(userId))
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const body = await request.json()
    const {
      uuid,
      companyName,
      website,
      logoUrl,
      addr1,
      addr2,
      city,
      state,
      postalCode,
      countryCode,
      phone,
      email,
    } = body

    // Check access via team-auth (owner, brand_admin, or platform admin/staff)
    const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
    const access = await getCompanyAccess(uuid, userId, isAdmin)

    if (!access) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (!hasMinRole(access.role, 'brand_admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const existingCompany = access.company

    // Update company
    await db.update(company)
      .set({
        companyName,
        website,
        logoUrl,
        addr1,
        addr2,
        city,
        state,
        postalCode,
        countryCode,
        phone,
        email,
      })
      .where(eq(company.id, existingCompany.id))

    return NextResponse.json({ uuid: existingCompany.uuid, id: existingCompany.id })
  } catch (error) {
    console.error('Error updating company:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}
