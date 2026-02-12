import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'

// Create a slug for newsroom URL
function createNrUri(name: string): string {
  return slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  }).slice(0, 32)
}

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
    const nrUri = createNrUri(companyName)

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

    return NextResponse.json({ uuid: newCompany.uuid, id: newCompany.id })
  } catch (error) {
    console.error('Error creating company:', error)
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

    // Find existing company
    const existingCompany = await db.query.company.findFirst({
      where: eq(company.uuid, uuid),
    })

    if (!existingCompany) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
    if (existingCompany.userId !== userId && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

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
