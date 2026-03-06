import { auth } from '@/lib/auth'
import { db } from '@/db'
import { globalMessages, userMessages, users, userProfiles } from '@/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

// GET: List all global messages + sent individual messages
export async function GET() {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const globals = await db
    .select()
    .from(globalMessages)
    .orderBy(desc(globalMessages.createdAt))

  const sent = await db
    .select({
      id: userMessages.id,
      fromId: userMessages.fromId,
      toId: userMessages.toId,
      subject: userMessages.subject,
      body: userMessages.body,
      isRead: userMessages.isRead,
      emailSent: userMessages.emailSent,
      createdAt: userMessages.createdAt,
      recipientEmail: users.email,
      recipientFirstName: userProfiles.firstName,
      recipientLastName: userProfiles.lastName,
    })
    .from(userMessages)
    .innerJoin(users, eq(userMessages.toId, users.id))
    .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
    .where(sql`${userMessages.fromId} IS NOT NULL`)
    .orderBy(desc(userMessages.createdAt))

  return NextResponse.json({ globals, sent })
}

// POST: Create global message
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!(session?.user as any)?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { subject, body: messageBody, expiresAt } = body

  if (!subject?.trim() || !messageBody?.trim()) {
    return NextResponse.json({ error: 'Subject and body are required' }, { status: 400 })
  }

  const adminId = parseInt(session!.user!.id!)

  const [message] = await db.insert(globalMessages).values({
    subject: subject.trim(),
    body: messageBody,
    createdBy: adminId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning()

  return NextResponse.json(message, { status: 201 })
}
