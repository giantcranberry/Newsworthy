import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, banners } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { uploadPRImage, deletePRImage } from '@/services/s3'
import { getUserCompanyIds } from '@/lib/team-auth'

function isEditorialUser(session: any): boolean {
  const user = session?.user
  return !!(user && ((user as any).isEditor || (user as any).isAdmin))
}

async function getRelease(uuid: string, userId: number, session: any, withBanner: boolean = false) {
  const where = eq(releases.uuid, uuid)
  const release = withBanner
    ? await db.query.releases.findFirst({ where, with: { banner: true } })
    : await db.query.releases.findFirst({ where })
  if (!release) return null
  if (isEditorialUser(session)) return release
  if (release.userId === userId) return release
  const companyIds = await getUserCompanyIds(userId)
  if (companyIds.includes(release.companyId)) return release
  return null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)


  try {
    const release = await getRelease(uuid, userId, session, true) as any

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Use the release owner's userId for banner records
    const bannerOwnerId = release.userId

    const contentType = request.headers.get('content-type') || ''

    // Handle selecting an existing banner from library (JSON body)
    if (contentType.includes('application/json')) {
      const { bannerId } = await request.json()
      if (!bannerId) {
        return NextResponse.json({ error: 'bannerId is required' }, { status: 400 })
      }

      const existingBanner = await db.query.banners.findFirst({
        where: eq(banners.id, bannerId),
      })

      if (!existingBanner) {
        return NextResponse.json({ error: 'Banner not found' }, { status: 404 })
      }

      await db.update(releases)
        .set({ bannerId: existingBanner.id })
        .where(eq(releases.id, release.id))

      return NextResponse.json({ success: true, banner: existingBanner })
    }

    // Handle file upload (FormData body)
    const formData = await request.formData()
    const file = formData.get('banner') as File | null
    const title = formData.get('title') as string | null
    const imgCredits = formData.get('imgCredits') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Banner file is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Linode S3
    const { url, width, height, filesize } = await uploadPRImage(buffer, release.id, 'banner')

    // Delete old banner from S3 if it exists
    if (release.banner?.url) {
      await deletePRImage(release.banner.url)
    }

    // Create the banner record
    const [banner] = await db.insert(banners).values({
      uuid: randomUUID(),
      userId: bannerOwnerId,
      companyId: release.companyId,
      url,
      frontPageUrl: url,
      cdnUrl: url,
      title: title || null,
      imgCredits: imgCredits || null,
      width,
      height,
      filesize,
      source: 'linode',
    }).returning()

    // Link the banner to the release
    await db.update(releases)
      .set({ bannerId: banner.id })
      .where(eq(releases.id, release.id))

    return NextResponse.json({ success: true, banner })
  } catch (error) {
    console.error('[API] Error creating banner:', error)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)


  try {
    const release = await getRelease(uuid, userId, session)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (!release.bannerId) {
      return NextResponse.json({ error: 'No banner to update' }, { status: 400 })
    }

    const { title, imgCredits } = await request.json()

    await db.update(banners)
      .set({
        title: title || null,
        imgCredits: imgCredits || null,
      })
      .where(eq(banners.id, release.bannerId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error updating banner:', error)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)


  try {
    const release = await getRelease(uuid, userId, session, true) as any

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    return NextResponse.json({
      banner: release.banner || null,
    })
  } catch (error) {
    console.error('[API] Error fetching banner:', error)
    return NextResponse.json({ error: 'Failed to fetch banner' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)


  try {
    const release = await getRelease(uuid, userId, session, true) as any

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Delete from S3 if stored there
    if (release.banner?.url) {
      await deletePRImage(release.banner.url)
    }

    // Unlink the banner from the release
    await db.update(releases)
      .set({ bannerId: null })
      .where(eq(releases.id, release.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error removing banner:', error)
    return NextResponse.json({ error: 'Failed to remove banner' }, { status: 500 })
  }
}
