import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company, images, banners, releases } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { uploadCompanyImage, uploadPRImage, deletePRImage } from '@/services/s3'

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

// GET: Paginated image assets for a company
export async function GET(
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

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const perPage = 24

  const notDeleted = and(
    eq(images.companyId, co.id),
    sql`${images.isDeleted} IS NOT TRUE`
  )

  const items = await db
    .select()
    .from(images)
    .where(notDeleted)
    .orderBy(desc(images.id))
    .limit(perPage)
    .offset((page - 1) * perPage)

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(images)
    .where(notDeleted)

  const total = Number(countRow?.count || 0)

  return NextResponse.json({
    images: items,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  })
}

// POST: Upload a new image asset
export async function POST(
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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const imgCredits = formData.get('imgCredits') as string | null
  const unsplashUrl = formData.get('unsplashUrl') as string | null
  const unsplashPhotoId = formData.get('unsplashPhotoId') as string | null
  const unsplashPageUrl = formData.get('unsplashPageUrl') as string | null
  const filter = formData.get('filter') as string | null

  if (!file && !unsplashUrl) {
    return NextResponse.json({ error: 'No file or Unsplash URL provided' }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Alt description is required' }, { status: 400 })
  }

  let buffer: Buffer
  let source = 'upload'
  let sourceLink: string | null = null

  if (unsplashUrl) {
    // Fetch image from Unsplash
    const imgRes = await fetch(unsplashUrl)
    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch Unsplash image' }, { status: 502 })
    }
    buffer = Buffer.from(await imgRes.arrayBuffer())
    source = 'unsplash'
    sourceLink = unsplashPageUrl || null

    // Trigger Unsplash download tracking per API guidelines
    if (unsplashPhotoId) {
      const unsplashKey = process.env.UNSPLASH_KEY
      if (unsplashKey) {
        fetch(`https://api.unsplash.com/photos/${unsplashPhotoId}/download`, {
          headers: { Authorization: `Client-ID ${unsplashKey}` },
        }).catch(() => {})
      }
    }
  } else {
    buffer = Buffer.from(await file!.arrayBuffer())
  }

  if (filter === 'social') {
    // Social images go to banners table, processed as 1200x630 banner
    const { url, width, height, filesize } = await uploadPRImage(buffer, co.id, 'banner')

    const [newBanner] = await db.insert(banners).values({
      uuid: randomUUID(),
      userId,
      companyId: co.id,
      title: title.trim(),
      imgCredits: imgCredits?.trim() || null,
      url,
      width,
      height,
      filesize,
      source,
      sourceLink,
    }).returning()

    return NextResponse.json({ success: true, image: newBanner })
  }

  // Default: news images
  const { url, width, height, filesize } = await uploadCompanyImage(buffer, co.id)

  const [newImage] = await db.insert(images).values({
    uuid: randomUUID(),
    userId,
    companyId: co.id,
    title: title.trim(),
    imgCredits: imgCredits?.trim() || null,
    url,
    width,
    height,
    filesize,
    source,
    sourceLink,
  }).returning()

  return NextResponse.json({ success: true, image: newImage })
}

// PUT: Update image metadata
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

  const { imageId, title, imgCredits, filter } = await request.json()

  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Alt description is required' }, { status: 400 })
  }

  if (filter === 'social') {
    const banner = await db.query.banners.findFirst({
      where: isAdmin
        ? and(eq(banners.id, imageId), eq(banners.companyId, co.id))
        : and(eq(banners.id, imageId), eq(banners.companyId, co.id), eq(banners.userId, userId)),
    })

    if (!banner) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    await db.update(banners)
      .set({
        title: title.trim(),
        imgCredits: imgCredits?.trim() || null,
      })
      .where(eq(banners.id, banner.id))

    return NextResponse.json({ success: true })
  }

  const image = await db.query.images.findFirst({
    where: isAdmin
      ? and(eq(images.id, imageId), eq(images.companyId, co.id))
      : and(eq(images.id, imageId), eq(images.companyId, co.id), eq(images.userId, userId)),
  })

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  await db.update(images)
    .set({
      title: title.trim(),
      imgCredits: imgCredits?.trim() || null,
    })
    .where(eq(images.id, image.id))

  return NextResponse.json({ success: true })
}

// DELETE: Soft-delete an image asset
export async function DELETE(
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

  const { imageId, filter } = await request.json()

  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
  }

  if (filter === 'social') {
    const banner = await db.query.banners.findFirst({
      where: isAdmin
        ? and(eq(banners.id, imageId), eq(banners.companyId, co.id))
        : and(eq(banners.id, imageId), eq(banners.companyId, co.id), eq(banners.userId, userId)),
    })

    if (!banner) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Check if banner is attached to any press release
    const attachedRelease = await db.query.releases.findFirst({
      where: eq(releases.bannerId, banner.id),
      columns: { id: true, title: true },
    })

    if (attachedRelease) {
      return NextResponse.json({
        error: `This image is attached to a press release ("${attachedRelease.title || 'Untitled'}") and cannot be deleted.`,
      }, { status: 409 })
    }

    if (banner.url) {
      await deletePRImage(banner.url)
    }

    await db.update(banners)
      .set({ isDeleted: true })
      .where(eq(banners.id, banner.id))

    return NextResponse.json({ success: true })
  }

  const image = await db.query.images.findFirst({
    where: isAdmin
      ? and(eq(images.id, imageId), eq(images.companyId, co.id))
      : and(eq(images.id, imageId), eq(images.companyId, co.id), eq(images.userId, userId)),
  })

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  // Remove from S3
  if (image.url) {
    await deletePRImage(image.url)
  }

  await db.update(images)
    .set({ isDeleted: true })
    .where(eq(images.id, image.id))

  return NextResponse.json({ success: true })
}
