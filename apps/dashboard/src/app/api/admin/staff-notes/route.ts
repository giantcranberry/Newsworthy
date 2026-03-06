import { auth } from '@/lib/auth'
import { db } from '@/db'
import { staffNotes } from '@/db/schema'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, body } = await request.json()

  if (!userId || !body || body.trim().length < 10) {
    return NextResponse.json({ error: 'Note must be at least 10 characters' }, { status: 400 })
  }

  const staffName = session?.user?.name || session?.user?.email || 'Staff'

  const [note] = await db
    .insert(staffNotes)
    .values({
      userId,
      staffName: staffName.substring(0, 32),
      body: body.trim(),
    })
    .returning()

  return NextResponse.json(note)
}
