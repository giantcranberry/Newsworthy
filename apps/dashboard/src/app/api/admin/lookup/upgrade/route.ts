import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

const VALID_TYPES = ['standard', 'enhanced', 'yahoo']

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { releaseId, distribution } = await request.json()

    if (!releaseId || !distribution) {
      return NextResponse.json({ error: 'Release ID and distribution required' }, { status: 400 })
    }

    // Validate distribution types
    const types = distribution.split(',').map((t: string) => t.trim()).filter(Boolean)
    if (types.length === 0 || !types.every((t: string) => VALID_TYPES.includes(t))) {
      return NextResponse.json({ error: 'Invalid distribution type' }, { status: 400 })
    }

    // Verify release exists
    const release = await db.query.releases.findFirst({
      where: eq(releases.id, releaseId),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    // Update distribution
    await db.update(releases)
      .set({ distribution })
      .where(eq(releases.id, releaseId))

    return NextResponse.json({ success: true, distribution })
  } catch (error) {
    console.error('Error upgrading distribution:', error)
    return NextResponse.json({ error: 'Failed to upgrade distribution' }, { status: 500 })
  }
}
