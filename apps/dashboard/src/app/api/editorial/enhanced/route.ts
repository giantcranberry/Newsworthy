import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseEnhanced } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, reportUrl } = body

    if (!releaseId || !reportUrl) {
      return NextResponse.json({ error: 'Release ID and report URL are required' }, { status: 400 })
    }

    // Find the enhanced record
    const existing = await db
      .select()
      .from(releaseEnhanced)
      .where(eq(releaseEnhanced.prid, releaseId))
      .limit(1)

    if (existing.length > 0) {
      // Update existing record
      await db.update(releaseEnhanced)
        .set({
          reportUrl,
          ingestedAt: new Date(),
        })
        .where(eq(releaseEnhanced.prid, releaseId))
    } else {
      // Create new record
      await db.insert(releaseEnhanced).values({
        prid: releaseId,
        reportUrl,
        ingestedAt: new Date(),
        createdAt: new Date(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving enhanced report:', error)
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth()

  const isEditor = (session?.user as any)?.isEditor
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isEditor && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { releaseId, action } = body

    if (action === 'reset_standard') {
      // Reset distribution to standard
      await db.update(releases)
        .set({ distribution: 'standard' })
        .where(eq(releases.id, releaseId))

      // Remove enhanced record if exists
      await db.delete(releaseEnhanced)
        .where(eq(releaseEnhanced.prid, releaseId))

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error resetting distribution:', error)
    return NextResponse.json({ error: 'Failed to reset distribution' }, { status: 500 })
  }
}
