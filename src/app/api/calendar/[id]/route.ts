import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contentCalendar } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from '@/lib/google-calendar'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await db.query.contentCalendar.findFirst({
      where: and(eq(contentCalendar.id, parseInt(id)), eq(contentCalendar.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = await request.json()
    const { title, description, eventType, eventDate, eventTime, status, color, companyId, releaseId } = body

    const [updated] = await db.update(contentCalendar)
      .set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(eventType !== undefined && { eventType }),
        ...(eventDate !== undefined && { eventDate }),
        ...(eventTime !== undefined && { eventTime }),
        ...(status !== undefined && { status }),
        ...(color !== undefined && { color }),
        ...(companyId !== undefined && { companyId: companyId ? parseInt(companyId) : null }),
        ...(releaseId !== undefined && { releaseId: releaseId ? parseInt(releaseId) : null }),
        updatedAt: new Date(),
      })
      .where(eq(contentCalendar.id, parseInt(id)))
      .returning()

    // Best-effort Google Calendar sync
    const eventData = {
      title: updated.title,
      description: updated.description,
      eventDate: updated.eventDate,
      eventTime: updated.eventTime,
    }

    if (existing.googleEventId) {
      await updateGoogleEvent(userId, existing.googleEventId, eventData)
    } else {
      const googleEventId = await createGoogleEvent(userId, eventData)
      if (googleEventId) {
        await db
          .update(contentCalendar)
          .set({ googleEventId })
          .where(eq(contentCalendar.id, parseInt(id)))
      }
    }

    return NextResponse.json({ event: updated })
  } catch (error) {
    console.error('[Calendar] Error updating event:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const existing = await db.query.contentCalendar.findFirst({
      where: and(eq(contentCalendar.id, parseInt(id)), eq(contentCalendar.userId, userId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Best-effort Google Calendar delete
    if (existing.googleEventId) {
      await deleteGoogleEvent(userId, existing.googleEventId)
    }

    await db.delete(contentCalendar).where(eq(contentCalendar.id, parseInt(id)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Calendar] Error deleting event:', error)
    return NextResponse.json({ error: 'Failed to delete event' }, { status: 500 })
  }
}
