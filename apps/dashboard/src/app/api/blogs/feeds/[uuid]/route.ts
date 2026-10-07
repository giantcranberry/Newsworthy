import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { blogFeeds, blogPosts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { getBlogCreditsForCompany } from '@/lib/blogs/access'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = parseInt(session.user.id)

  const { uuid } = await params

  const feed = await db.query.blogFeeds.findFirst({
    where: and(eq(blogFeeds.uuid, uuid), eq(blogFeeds.isDeleted, false)),
    columns: { id: true, companyId: true },
  })
  if (!feed) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowed = await getUserCompanyIds(userId, 'brand_admin')
  if (!allowed.includes(feed.companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Guard: only deletable while no blog PR credits remain for the brand.
  const credits = await getBlogCreditsForCompany(feed.companyId)
  if (credits.totalCredits > 0) {
    return NextResponse.json(
      { error: 'This feed has blog PR credits. Use your credits or let them expire before deleting.' },
      { status: 409 },
    )
  }

  await db.delete(blogPosts).where(eq(blogPosts.feedId, feed.id))
  await db
    .update(blogFeeds)
    .set({ isDeleted: true, updatedAt: new Date() })
    .where(eq(blogFeeds.id, feed.id))

  return NextResponse.json({ ok: true })
}
