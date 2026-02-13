import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, brandCredits } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const { uuid } = await params

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Only allow deletion of releases not in approved/sent/editorial status
    const protectedStatuses = ['approved', 'sent', 'editorial']
    if (release.status && protectedStatuses.includes(release.status)) {
      return NextResponse.json(
        { error: `Cannot delete release with status "${release.status}"` },
        { status: 403 }
      )
    }

    // Reallocate credits: remove the negative credit entries linked to this release
    await db.delete(brandCredits).where(
      and(
        eq(brandCredits.prId, release.id),
        eq(brandCredits.userId, userId)
      )
    )

    // Soft-delete the release
    await db.update(releases)
      .set({ isDeleted: true })
      .where(eq(releases.id, release.id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting release:', error)
    return NextResponse.json(
      { error: 'Failed to delete release' },
      { status: 500 }
    )
  }
}
