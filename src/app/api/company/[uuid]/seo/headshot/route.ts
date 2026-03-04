import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { uploadPersonHeadshot, deleteLogo } from '@/services/s3'

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

  const co = await db.query.company.findFirst({
    where: isAdmin
      ? eq(company.uuid, uuid)
      : and(eq(company.uuid, uuid), eq(company.userId, userId)),
  })

  if (!co) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('headshot') as File | null
    const oldUrl = formData.get('oldUrl') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and WebP files are supported' }, { status: 400 })
    }

    // Delete old headshot if it's on our CDN
    if (oldUrl && oldUrl.includes('linodeobjects.com')) {
      await deleteLogo(oldUrl)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const imageUrl = await uploadPersonHeadshot(buffer, co.id, file.type)

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('[API] Error uploading person headshot:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
