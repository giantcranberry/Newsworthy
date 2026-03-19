import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, company } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { uploadLogo, deleteLogo } from '@/services/s3'
import { getUserCompanyIds } from '@/lib/team-auth'

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
    // Get the release to find the company
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
      with: {
        company: true,
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const formData = await request.formData()
    const file = formData.get('logo') as File

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Delete old logo if exists
    if (release.company?.logoUrl) {
      await deleteLogo(release.company.logoUrl)
    }

    // Upload new logo
    const buffer = Buffer.from(await file.arrayBuffer())
    const logoUrl = await uploadLogo(buffer, release.companyId, file.type)

    // Update the company logo
    await db.update(company)
      .set({ logoUrl })
      .where(
        and(
          eq(company.id, release.companyId),
          eq(company.userId, userId)
        )
      )

    return NextResponse.json({ success: true, logoUrl })
  } catch (error) {
    console.error('[API] Error uploading logo:', error)
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 })
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
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
      with: {
        company: true,
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({
      logoUrl: release.company?.logoUrl || null,
      companyName: release.company?.companyName || '',
    })
  } catch (error) {
    console.error('[API] Error fetching logo:', error)
    return NextResponse.json({ error: 'Failed to fetch logo' }, { status: 500 })
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
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
      with: {
        company: true,
      },
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Delete logo from S3
    if (release.company?.logoUrl) {
      await deleteLogo(release.company.logoUrl)
    }

    // Clear the company logo URL
    await db.update(company)
      .set({ logoUrl: null })
      .where(
        and(
          eq(company.id, release.companyId),
          eq(company.userId, userId)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Error deleting logo:', error)
    return NextResponse.json({ error: 'Failed to delete logo' }, { status: 500 })
  }
}
