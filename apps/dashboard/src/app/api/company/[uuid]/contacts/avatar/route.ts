import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contact, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { uploadContactAvatar, deleteLogo } from '@/services/s3'
import { getCompanyAccess, hasMinRole } from '@/lib/team-auth'

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
  const access = await getCompanyAccess(uuid, userId, isAdmin)

  if (!access) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  if (!hasMinRole(access.role, 'brand_admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const co = access.company

  try {
    const formData = await request.formData()
    const file = formData.get('avatar') as File | null
    const contactUuid = formData.get('contactUuid') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File must be under 5MB' }, { status: 400 })
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and WebP files are supported' }, { status: 400 })
    }

    if (!contactUuid) {
      return NextResponse.json({ error: 'contactUuid is required' }, { status: 400 })
    }

    const existing = await db.query.contact.findFirst({
      where: and(eq(contact.uuid, contactUuid), eq(contact.companyId, co.id)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }

    // Delete old avatar if exists
    if (existing.avatar) {
      await deleteLogo(existing.avatar)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const avatarUrl = await uploadContactAvatar(buffer, existing.id, file.type)

    await db.update(contact)
      .set({ avatar: avatarUrl })
      .where(eq(contact.id, existing.id))

    return NextResponse.json({ success: true, avatarUrl })
  } catch (error) {
    console.error('[API] Error uploading contact avatar:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}
