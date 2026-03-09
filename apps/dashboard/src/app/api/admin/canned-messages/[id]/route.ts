import { auth } from '@/lib/auth'
import { db } from '@/db'
import { cannedMsgs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.isAdmin && !user?.isEditor && !user?.isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const msgId = parseInt(id)
  if (isNaN(msgId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  await db.delete(cannedMsgs).where(eq(cannedMsgs.id, msgId))

  return NextResponse.json({ success: true })
}
