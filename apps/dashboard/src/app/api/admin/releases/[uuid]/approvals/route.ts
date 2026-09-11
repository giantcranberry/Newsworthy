import { auth } from '@/lib/auth'
import { db } from '@/db'
import { releases, approvals } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { uuid } = await params

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release || release.isDeleted) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.status !== 'sent') {
      return NextResponse.json(
        { error: 'Approval requests can only be cleared for sent releases' },
        { status: 400 }
      )
    }

    const deleted = await db
      .delete(approvals)
      .where(and(eq(approvals.releaseId, release.id), isNull(approvals.signedAt)))
      .returning({ id: approvals.id })

    return NextResponse.json({
      success: true,
      cleared: deleted.length,
    })
  } catch (error) {
    console.error('[Admin] Error clearing pending approvals:', error)
    return NextResponse.json({ error: 'Failed to clear approval requests' }, { status: 500 })
  }
}
