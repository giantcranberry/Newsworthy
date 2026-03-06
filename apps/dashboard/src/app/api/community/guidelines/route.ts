import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityGuidelines, communityGuidelineAcceptances } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [guidelines] = await db.select().from(communityGuidelines).limit(1)
  const [acceptance] = await db
    .select()
    .from(communityGuidelineAcceptances)
    .where(eq(communityGuidelineAcceptances.userId, userId))
    .limit(1)

  const guidelinesUpdatedAt = guidelines?.updatedAt ? new Date(guidelines.updatedAt) : null
  const acceptedAt = acceptance?.acceptedAt ? new Date(acceptance.acceptedAt) : null

  // User needs to accept if they never accepted or guidelines were updated after their acceptance
  const accepted = !!(acceptedAt && guidelinesUpdatedAt && acceptedAt >= guidelinesUpdatedAt)

  return NextResponse.json({
    body: guidelines?.body || '',
    accepted,
    updatedAt: guidelines?.updatedAt || null,
  })
}
