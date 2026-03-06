import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityGuidelineAcceptances } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST() {
  const session = await getEffectiveSession()
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Upsert: update if exists, insert if not
  const [existing] = await db
    .select()
    .from(communityGuidelineAcceptances)
    .where(eq(communityGuidelineAcceptances.userId, userId))
    .limit(1)

  if (existing) {
    await db
      .update(communityGuidelineAcceptances)
      .set({ acceptedAt: new Date() })
      .where(eq(communityGuidelineAcceptances.id, existing.id))
  } else {
    await db
      .insert(communityGuidelineAcceptances)
      .values({ userId })
  }

  return NextResponse.json({ accepted: true })
}
