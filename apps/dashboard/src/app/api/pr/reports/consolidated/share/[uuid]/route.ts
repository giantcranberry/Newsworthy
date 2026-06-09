import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { consolidatedReports } from '@/db/schema'
import { and, eq } from 'drizzle-orm'

// DELETE — revoke (soft-delete) a shared consolidated report owned by the user
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const existing = await db.query.consolidatedReports.findFirst({
    where: eq(consolidatedReports.uuid, uuid),
    columns: { userId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = (session?.user as any)?.isAdmin
  if (!isAdmin && existing.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db
    .update(consolidatedReports)
    .set({ isDeleted: true })
    .where(and(eq(consolidatedReports.uuid, uuid)))

  return NextResponse.json({ ok: true })
}
