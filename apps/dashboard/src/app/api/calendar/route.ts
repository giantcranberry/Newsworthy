import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { contentCalendar, company } from '@/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { createGoogleEvent } from '@/lib/google-calendar'

export async function GET(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const companyId = searchParams.get('companyId')

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end date params required' }, { status: 400 })
  }

  try {
    const conditions = [
      eq(contentCalendar.userId, userId),
      gte(contentCalendar.eventDate, start),
      lte(contentCalendar.eventDate, end),
    ]

    if (companyId) {
      conditions.push(eq(contentCalendar.companyId, parseInt(companyId)))
    }

    const events = await db
      .select({
        id: contentCalendar.id,
        title: contentCalendar.title,
        description: contentCalendar.description,
        eventType: contentCalendar.eventType,
        eventDate: contentCalendar.eventDate,
        eventTime: contentCalendar.eventTime,
        status: contentCalendar.status,
        color: contentCalendar.color,
        companyId: contentCalendar.companyId,
        companyName: company.companyName,
        releaseId: contentCalendar.releaseId,
        createdAt: contentCalendar.createdAt,
        updatedAt: contentCalendar.updatedAt,
      })
      .from(contentCalendar)
      .leftJoin(company, eq(contentCalendar.companyId, company.id))
      .where(and(...conditions))
      .orderBy(contentCalendar.eventDate)

    return NextResponse.json({ events })
  } catch (error) {
    console.error('[Calendar] Error fetching events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { title, description, eventType, eventDate, eventTime, status, color, companyId, releaseId } = body

    if (!title || !eventDate) {
      return NextResponse.json({ error: 'Title and event date are required' }, { status: 400 })
    }

    const [event] = await db.insert(contentCalendar).values({
      userId,
      title,
      description: description || null,
      eventType: eventType || 'press_release',
      eventDate,
      eventTime: eventTime || null,
      status: status || 'planned',
      color: color || '#3b82f6',
      companyId: companyId ? parseInt(companyId) : null,
      releaseId: releaseId ? parseInt(releaseId) : null,
    }).returning()

    // Best-effort Google Calendar sync
    const googleEventId = await createGoogleEvent(userId, {
      title,
      description: description || null,
      eventDate,
      eventTime: eventTime || null,
    })

    if (googleEventId) {
      await db
        .update(contentCalendar)
        .set({ googleEventId })
        .where(eq(contentCalendar.id, event.id))
      event.googleEventId = googleEventId
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('[Calendar] Error creating event:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
