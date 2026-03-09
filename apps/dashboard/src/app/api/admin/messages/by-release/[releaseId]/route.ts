import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userMessages, users, userProfiles } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const session = await auth()
  const user = session?.user as any
  if (!user?.isAdmin && !user?.isEditor && !user?.isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { releaseId } = await params
  const id = parseInt(releaseId)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid release ID' }, { status: 400 })
  }

  const messages = await db
    .select({
      id: userMessages.id,
      subject: userMessages.subject,
      body: userMessages.body,
      emailSent: userMessages.emailSent,
      isRead: userMessages.isRead,
      createdAt: userMessages.createdAt,
      senderEmail: users.email,
      senderFirstName: userProfiles.firstName,
      senderLastName: userProfiles.lastName,
    })
    .from(userMessages)
    .leftJoin(users, eq(userMessages.fromId, users.id))
    .leftJoin(userProfiles, eq(userMessages.fromId, userProfiles.userId))
    .where(eq(userMessages.releaseId, id))
    .orderBy(desc(userMessages.createdAt))

  return NextResponse.json(messages)
}
