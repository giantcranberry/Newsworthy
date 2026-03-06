import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { communityPosts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  const [post] = await db
    .select({ id: communityPosts.id, isPinned: communityPosts.isPinned })
    .from(communityPosts)
    .where(eq(communityPosts.uuid, uuid))
    .limit(1)

  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const [updated] = await db
    .update(communityPosts)
    .set({ isPinned: !post.isPinned, updatedAt: new Date() })
    .where(eq(communityPosts.id, post.id))
    .returning()

  return NextResponse.json(updated)
}
