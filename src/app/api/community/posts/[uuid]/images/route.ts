import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { communityPosts, communityPostImages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { uploadCommunityImage, deleteCommunityImage } from '@/services/s3'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGES = 4

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [post] = await db
    .select({ id: communityPosts.id, userId: communityPosts.userId })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (post.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await request.formData()
  const files = formData.getAll('images') as File[]

  if (!files.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 })
  }

  if (files.length > MAX_IMAGES) {
    return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 })
  }

  // Validate all files before uploading
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP` },
        { status: 400 }
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large: ${file.name}. Maximum 5MB per image` },
        { status: 400 }
      )
    }
  }

  const created = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, width, height } = await uploadCommunityImage(buffer, post.id)

    const [image] = await db
      .insert(communityPostImages)
      .values({
        postId: post.id,
        url,
        width,
        height,
        sortOrder: i,
      })
      .returning()

    created.push(image)
  }

  return NextResponse.json(created, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params
  const { imageId } = await request.json()

  if (!imageId) {
    return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
  }

  const [post] = await db
    .select({ id: communityPosts.id, userId: communityPosts.userId })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const isAdmin = (session?.user as any)?.isAdmin
  if (post.userId !== userId && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [image] = await db
    .select()
    .from(communityPostImages)
    .where(
      and(
        eq(communityPostImages.id, imageId),
        eq(communityPostImages.postId, post.id)
      )
    )
    .limit(1)

  if (!image) {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  await deleteCommunityImage(image.url)

  await db
    .delete(communityPostImages)
    .where(eq(communityPostImages.id, imageId))

  return NextResponse.json({ success: true })
}
