import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { uploadLogo, deleteLogo } from '@/services/s3'

export async function POST(request: Request) {
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null
    const companyUuid = formData.get('companyUuid') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!companyUuid) {
      return NextResponse.json({ error: 'companyUuid is required' }, { status: 400 })
    }

    const isAdmin = !!(session?.user as any)?.isAdmin || !!(session?.user as any)?.isStaff
    const existing = await db.query.company.findFirst({
      where: isAdmin
        ? eq(company.uuid, companyUuid)
        : and(
            eq(company.uuid, companyUuid),
            eq(company.userId, userId)
          ),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Delete old logo if exists
    if (existing.logoUrl) {
      await deleteLogo(existing.logoUrl)
    }

    // Upload new logo to S3
    const buffer = Buffer.from(await file.arrayBuffer())
    const logoUrl = await uploadLogo(buffer, existing.id, file.type)

    // Update company record
    await db.update(company)
      .set({ logoUrl })
      .where(eq(company.id, existing.id))

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    console.error('[API] Error uploading company logo:', error)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
  }
}
