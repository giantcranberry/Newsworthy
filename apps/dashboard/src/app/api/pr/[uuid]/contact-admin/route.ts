import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseNotes } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getUserCompanyIds } from '@/lib/team-auth'
import { sendSmsNotification } from '@/lib/twilio'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const session = await getEffectiveSession()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)
  const userName = session.user.name || 'User'
  const { uuid } = await params

  const { message } = await request.json()
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  try {
    const release = await db.query.releases.findFirst({
      where: eq(releases.uuid, uuid),
    })

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    if (release.userId !== userId) {
      const companyIds = await getUserCompanyIds(userId)
      if (!companyIds.includes(release.companyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    if (release.status !== 'approved') {
      return NextResponse.json(
        { error: 'This action is only available for approved releases' },
        { status: 400 }
      )
    }

    await db.insert(releaseNotes).values({
      prId: release.id,
      note: `[User Message] ${message.trim()}`,
      fromId: userId,
      fromName: userName,
    })

    sendSmsNotification(`[Newsworthy] Message from ${userName} re: "${release.title}"\n\n${message.trim()}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending message to admin:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
