import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, newsroomRedirects } from '@/db/schema'
import { eq, and, ne, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

async function getCompanyForUser(uuid: string, userId: number, isAdmin = false) {
  return db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(
          eq(company.uuid, uuid),
          eq(company.userId, userId)
        ),
  })
}

// GET: Check if a newsroom URI is unique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return NextResponse.json({ error: 'slug param required' }, { status: 400 })
  }

  const existing = await db.query.company.findFirst({
    where: and(
      eq(company.nrUri, slug.toLowerCase()),
      ne(company.uuid, uuid)
    ),
    columns: { id: true },
  })

  return NextResponse.json({ available: !existing })
}

// PUT: Update newsroom settings
export async function PUT(
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
  const co = await getCompanyForUser(uuid, userId, isAdmin)

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  const body = await request.json()
  const {
    nrUri,
    nrTitle,
    nrDesc,
    website,
    linkedinUrl,
    xUrl,
    youtubeUrl,
    instagramUrl,
    blogUrl,
    googleDriveUrl,
    dropboxUrl,
    boxUrl,
    agencyName,
    agencyWebsite,
    agencyContactName,
    agencyContactPhone,
    agencyContactEmail,
    gmb,
  } = body

  // Validate newsroom URI
  const slug = nrUri?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32)

  if (!slug || slug.length < 3) {
    return NextResponse.json({ error: 'Newsroom address must be at least 3 characters' }, { status: 400 })
  }

  // Check uniqueness
  const existing = await db.query.company.findFirst({
    where: and(
      eq(company.nrUri, slug),
      ne(company.uuid, uuid)
    ),
    columns: { id: true },
  })

  if (existing) {
    return NextResponse.json({ error: 'This newsroom address is already taken' }, { status: 409 })
  }

  // Log old URI for redirect if it changed
  if (co.nrUri && co.nrUri !== slug) {
    await db.insert(newsroomRedirects).values({
      companyId: co.id,
      oldUri: co.nrUri,
      newUri: slug,
    })
  }

  await db.update(company)
    .set({
      nrUri: slug,
      nrTitle: nrTitle?.trim().slice(0, 128) || null,
      nrDesc: nrDesc || null,
      website: website?.trim() || null,
      linkedinUrl: linkedinUrl?.trim() || null,
      xUrl: xUrl?.trim() || null,
      youtubeUrl: youtubeUrl?.trim() || null,
      instagramUrl: instagramUrl?.trim() || null,
      blogUrl: blogUrl?.trim() || null,
      googleDriveUrl: googleDriveUrl?.trim() || null,
      dropboxUrl: dropboxUrl?.trim() || null,
      boxUrl: boxUrl?.trim() || null,
      agencyName: agencyName?.trim() || null,
      agencyWebsite: agencyWebsite?.trim() || null,
      agencyContactName: agencyContactName?.trim() || null,
      agencyContactPhone: agencyContactPhone?.trim() || null,
      agencyContactEmail: agencyContactEmail?.trim() || null,
      gmb: gmb?.trim() || null,
    })
    .where(eq(company.id, co.id))

  return NextResponse.json({ success: true })
}
