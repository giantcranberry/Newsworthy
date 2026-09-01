import { auth } from '@/lib/auth'
import { db } from '@/db'
import { blocklistTerms } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    if (!(session?.user as any)?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id: idParam } = await params
    const id = Number(idParam)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const [deleted] = await db
      .delete(blocklistTerms)
      .where(eq(blocklistTerms.id, id))
      .returning({ id: blocklistTerms.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting blocklist term:', error)
    return NextResponse.json(
      { error: 'Failed to delete term' },
      { status: 500 },
    )
  }
}
