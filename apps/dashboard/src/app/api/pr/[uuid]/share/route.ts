import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseOptions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { NextResponse } from 'next/server'

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
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { advocacy } = await request.json()

    // Check if release options exist
    const existingOptions = await db.query.releaseOptions.findFirst({
      where: eq(releaseOptions.prId, release.id),
    })

    if (existingOptions) {
      // Update existing
      await db.update(releaseOptions)
        .set({ advocacy: !!advocacy })
        .where(eq(releaseOptions.prId, release.id))
    } else {
      // Create new
      await db.insert(releaseOptions).values({
        prId: release.id,
        userId,
        advocacy: !!advocacy,
      })
    }

    return NextResponse.json({ success: true, advocacy: !!advocacy })
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
      where: and(
        eq(releases.uuid, uuid),
        eq(releases.userId, userId)
      ),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const options = await db.query.releaseOptions.findFirst({
      where: eq(releaseOptions.prId, release.id),
    })

    return NextResponse.json({
      advocacy: options?.advocacy || false,
    })
  } catch (error) {
    console.error('[API] Error fetching advocacy:', error)
    return NextResponse.json({ error: 'Failed to fetch advocacy setting' }, { status: 500 })
  }
}
