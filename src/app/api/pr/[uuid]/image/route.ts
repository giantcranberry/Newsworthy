import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, images, releaseImages } from '@/db/schema'
import { eq, and, asc, max } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { uploadPRImage } from '@/services/s3'

async function getRelease(uuid: string, userId: number) {
  return db.query.releases.findFirst({
    where: and(
      eq(releases.uuid, uuid),
      eq(releases.userId, userId)
    ),
  })
}

async function syncPrimaryImage(releaseId: number) {
  // Set primaryImageId to the first image (sort_order=0) or null
  const first = await db.query.releaseImages.findFirst({
    where: eq(releaseImages.releaseId, releaseId),
    orderBy: [asc(releaseImages.sortOrder)],
  })

  await db.update(releases)
    .set({ primaryImageId: first?.imageId ?? null })
    .where(eq(releases.id, releaseId))
}

// GET: Return all release images ordered by sort_order + image library
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
    const release = await getRelease(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Get all images attached to this release via junction table
    const ri = await db.query.releaseImages.findMany({
      where: eq(releaseImages.releaseId, release.id),
      orderBy: [asc(releaseImages.sortOrder)],
      with: { image: true },
    })

    // Get user's image library for the company
    const imageLibrary = await db.query.images.findMany({
      where: and(
        eq(images.companyId, release.companyId),
        eq(images.userId, userId),
        eq(images.isDeleted, false)
      ),
      orderBy: (images, { desc }) => [desc(images.id)],
      limit: 20,
    })

    return NextResponse.json({
      releaseImages: ri.map((r) => ({
        id: r.id,
        imageId: r.imageId,
        sortOrder: r.sortOrder,
        image: r.image,
      })),
      imageLibrary,
    })
  } catch (error) {
    console.error('[API] Error fetching images:', error)
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
  }
}

// POST: Add an image to the release (file upload or library pick)
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
    const release = await getRelease(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const contentType = request.headers.get('content-type') || ''
    let imageId: number

    if (contentType.includes('multipart/form-data')) {
      // File upload via FormData
      const formData = await request.formData()
      const file = formData.get('image') as File | null
      const title = formData.get('title') as string | null
      const imgCredits = formData.get('imgCredits') as string | null

      if (!file) {
        return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
      }

      if (!title?.trim()) {
        return NextResponse.json({ error: 'Alt description is required' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const { url, width, height, filesize } = await uploadPRImage(buffer, release.id, 'primary')

      const [image] = await db.insert(images).values({
        uuid: randomUUID(),
        userId,
        companyId: release.companyId,
        url,
        title: title || null,
        imgCredits: imgCredits || null,
        width,
        height,
        filesize,
        source: 'linode',
      }).returning()

      imageId = image.id
    } else {
      // JSON body: either imageId (library pick) or url (filestack legacy)
      const body = await request.json()

      if (body.imageId) {
        imageId = body.imageId
      } else if (body.url) {
        // Create new image record from URL (filestack)
        const [image] = await db.insert(images).values({
          uuid: randomUUID(),
          userId,
          companyId: release.companyId,
          url: body.url,
          title: body.title || null,
          caption: body.caption || null,
          imgCredits: body.imgCredits || null,
          width: body.width || null,
          height: body.height || null,
          filesize: body.filesize || null,
          source: 'filestack',
        }).returning()

        imageId = image.id
      } else {
        return NextResponse.json({ error: 'Image file, imageId, or url is required' }, { status: 400 })
      }
    }

    // Determine next sort_order
    const [maxResult] = await db
      .select({ maxSort: max(releaseImages.sortOrder) })
      .from(releaseImages)
      .where(eq(releaseImages.releaseId, release.id))

    const nextSort = (maxResult?.maxSort ?? -1) + 1

    // Insert into junction table
    const [ri] = await db.insert(releaseImages).values({
      releaseId: release.id,
      imageId,
      sortOrder: nextSort,
    }).returning()

    // Sync primary image
    await syncPrimaryImage(release.id)

    // Fetch the full image record to return
    const image = await db.query.images.findFirst({
      where: eq(images.id, imageId),
    })

    return NextResponse.json({
      success: true,
      releaseImage: {
        id: ri.id,
        imageId: ri.imageId,
        sortOrder: ri.sortOrder,
        image,
      },
    })
  } catch (error) {
    console.error('[API] Error adding image:', error)
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 })
  }
}

// PUT: Update metadata for a specific image
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
    const release = await getRelease(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { imageId, title, imgCredits } = await request.json()

    if (!imageId) {
      return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
    }

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Alt description is required' }, { status: 400 })
    }

    await db.update(images)
      .set({
        title: title || null,
        imgCredits: imgCredits || null,
      })
      .where(eq(images.id, imageId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error updating image:', error)
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
  }
}

// DELETE: Remove an image from the release
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
    const release = await getRelease(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const imageId = parseInt(searchParams.get('imageId') || '0')

    if (!imageId) {
      return NextResponse.json({ error: 'imageId query param is required' }, { status: 400 })
    }

    // Remove from junction table
    await db.delete(releaseImages)
      .where(and(
        eq(releaseImages.releaseId, release.id),
        eq(releaseImages.imageId, imageId)
      ))

    // Sync primary image
    await syncPrimaryImage(release.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error removing image:', error)
    return NextResponse.json({ error: 'Failed to remove image' }, { status: 500 })
  }
}

// PATCH: Reorder images
export async function PATCH(
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
    const release = await getRelease(uuid, userId)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { imageIds } = await request.json()

    if (!Array.isArray(imageIds)) {
      return NextResponse.json({ error: 'imageIds array is required' }, { status: 400 })
    }

    // Update sort_order for each image
    for (let i = 0; i < imageIds.length; i++) {
      await db.update(releaseImages)
        .set({ sortOrder: i })
        .where(and(
          eq(releaseImages.releaseId, release.id),
          eq(releaseImages.imageId, imageIds[i])
        ))
    }

    // Sync primary image to first in the new order
    await syncPrimaryImage(release.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error reordering images:', error)
    return NextResponse.json({ error: 'Failed to reorder images' }, { status: 500 })
  }
}
