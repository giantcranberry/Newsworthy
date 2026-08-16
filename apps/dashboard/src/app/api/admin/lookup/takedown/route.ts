import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { deleteDocument } from '@/lib/opensearch'
import { NextRequest, NextResponse } from 'next/server'
import { queueIndexNowForRelease } from '@/lib/indexnow'

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 401 })
  }

  const { releaseId } = await request.json()

  if (!releaseId) {
    return NextResponse.json({ error: 'Release ID required' }, { status: 400 })
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: {
      id: true,
      elasticDoc: true,
      isDeleted: true,
      slug: true,
      releaseAt: true,
    },
  })

  if (!release) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  if (release.isDeleted) {
    return NextResponse.json({ error: 'Release already taken down' }, { status: 400 })
  }

  // Soft delete the release
  await db.update(releases)
    .set({ isDeleted: true, isArchived: true })
    .where(eq(releases.id, releaseId))

  // Delete from ElasticSearch if document exists
  let esDeleted = false
  if (release.elasticDoc) {
    try {
      await deleteDocument('nw_releases', release.elasticDoc)
      esDeleted = true
    } catch (err: any) {
      // 404 means already deleted from ES, which is fine
      if (err?.statusCode !== 404) {
        console.error('Failed to delete ES document:', err)
      }
    }
  }

  queueIndexNowForRelease(release)

  return NextResponse.json({
    success: true,
    esDeleted,
    elasticDoc: release.elasticDoc,
  })
}
