import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getUserCompanyIds } from '@/lib/team-auth'

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
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
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

    const { advocacy, pitchlist } = await request.json()

    // Check if release options exist
    const existingOptions = await db.query.releaseOptions.findFirst({
      where: eq(releaseOptions.prId, release.id),
    })

    const updates: Record<string, any> = {}
    if (advocacy !== undefined) updates.advocacy = !!advocacy
    if (pitchlist !== undefined) updates.pitchlist = !!pitchlist

    if (existingOptions) {
      // Update existing
      await db.update(releaseOptions)
        .set(updates)
        .where(eq(releaseOptions.prId, release.id))
    } else {
      // Create new
      await db.insert(releaseOptions).values({
        prId: release.id,
        userId,
        advocacy: !!advocacy,
        pitchlist: !!pitchlist,
      })
    }

    return NextResponse.json({ success: true, advocacy: !!advocacy, pitchlist: !!pitchlist })
  } catch (error) {
    console.error('[API] Error updating advocacy:', error)
    return NextResponse.json({ error: 'Failed to update advocacy setting' }, { status: 500 })
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

    const options = await db.query.releaseOptions.findFirst({
      where: eq(releaseOptions.prId, release.id),
    })

    return NextResponse.json({
      advocacy: options?.advocacy || false,
      pitchlist: options?.pitchlist || false,
    })
  } catch (error) {
    console.error('[API] Error fetching advocacy:', error)
    return NextResponse.json({ error: 'Failed to fetch advocacy setting' }, { status: 500 })
  }
}
