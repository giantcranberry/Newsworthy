import { auth } from '@/lib/auth'
import { db } from '@/db'
import { nwaiAssets } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { uploadNwaiAsset, deleteNwaiAsset } from '@/services/s3'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt((session?.user as any)?.id || '0')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const description = (formData.get('description') as string | null)?.trim() || null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large (max 50MB)' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url, filesize } = await uploadNwaiAsset(buffer, file.name, file.type)

    const [asset] = await db
      .insert(nwaiAssets)
      .values({
        uuid: randomUUID(),
        userId,
        filename: file.name,
        url,
        mimeType: file.type || 'application/octet-stream',
        filesize,
        description,
      })
      .returning()

    return NextResponse.json({ success: true, asset })
  } catch (error) {
    console.error('Error uploading asset:', error)
    return NextResponse.json({ error: 'Failed to upload asset' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const uuid = new URL(request.url).searchParams.get('uuid')

    if (!uuid) {
      return NextResponse.json({ error: 'Missing uuid' }, { status: 400 })
    }

    const [asset] = await db
      .select()
      .from(nwaiAssets)
      .where(eq(nwaiAssets.uuid, uuid))
      .limit(1)

    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    await deleteNwaiAsset(asset.url)
    await db.delete(nwaiAssets).where(eq(nwaiAssets.id, asset.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting asset:', error)
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
  }
}
