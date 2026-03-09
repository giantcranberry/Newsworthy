import { auth } from '@/lib/auth'
import { db } from '@/db'
import { cannedMsgs } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: List all canned messages for route='quick-message'
export async function GET() {
  const session = await auth()
  const user = session?.user as any
  if (!user?.isAdmin && !user?.isEditor && !user?.isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const messages = await db
    .select()
    .from(cannedMsgs)
    .where(eq(cannedMsgs.route, 'quick-message'))

  return NextResponse.json(messages)
}

// POST: Create a new canned message
export async function POST(request: NextRequest) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.isAdmin && !user?.isEditor && !user?.isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { handle, subject, msg } = body

  if (!handle?.trim() || !msg?.trim()) {
    return NextResponse.json({ error: 'Label and message body are required' }, { status: 400 })
  }

  const [created] = await db.insert(cannedMsgs).values({
    route: 'quick-message',
    handle: handle.trim(),
    subject: subject?.trim() || null,
    msg: msg.trim(),
    createdBy: parseInt(session!.user!.id!),
  }).returning()

  return NextResponse.json(created, { status: 201 })
}
