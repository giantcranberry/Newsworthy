import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { releases, releaseEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getUserCompanyIds } from '@/lib/team-auth'

function isEditorialUser(session: any): boolean {
  const user = session?.user
  return !!(user && ((user as any).isEditor || (user as any).isAdmin))
}

async function getRelease(uuid: string, userId: number, session: any) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.uuid, uuid),
  })
  if (!release) return null

  // Editorial users can access any release
  if (isEditorialUser(session)) return release

  // Owner can access their own release
  if (release.userId === userId) return release

  // Team members can access their company's releases
  const companyIds = await getUserCompanyIds(userId)
  if (companyIds.includes(release.companyId)) return release

  return null
}

/**
 * Convert a date string + time string in a given IANA timezone to a UTC Date.
 */
function toUTCFromTimezone(date: string, time: string, tz: string): Date {
  const localStr = `${date}T${time}:00`
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const naive = new Date(localStr)
  const utcParts = formatter.formatToParts(naive)
  const get = (type: string) => utcParts.find((p) => p.type === type)?.value || '0'
  const inTz = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
  )
  const offsetMs = inTz.getTime() - naive.getTime()
  return new Date(naive.getTime() - offsetMs)
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const event = await db.query.releaseEvents.findFirst({
      where: eq(releaseEvents.prId, release.id),
    })

    if (!event) {
      return NextResponse.json({ event: null })
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('[API] Error fetching event:', error)
    return NextResponse.json({ error: 'Failed to fetch event' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params
  const session = await getEffectiveSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = parseInt(session.user.id)

  try {
    const release = await getRelease(uuid, userId, session)

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 })
    }

    const { startDate, startTime, endDate, endTime, location, timezone } = await request.json()

    // If all fields are empty, delete existing record
    if (!startDate && !startTime && !endDate && !endTime && !location) {
      await db.delete(releaseEvents).where(eq(releaseEvents.prId, release.id))
      return NextResponse.json({ success: true, event: null })
    }

    if (!startDate || !startTime) {
      return NextResponse.json({ error: 'Start date and time are required' }, { status: 400 })
    }

    const tz = timezone || 'America/New_York'
    const utcStartDate = toUTCFromTimezone(startDate, startTime, tz)

    let utcEndDate: Date | null = null
    if (endDate && endTime) {
      utcEndDate = toUTCFromTimezone(endDate, endTime, tz)
    }

    const existing = await db.query.releaseEvents.findFirst({
      where: eq(releaseEvents.prId, release.id),
    })

    if (existing) {
      await db.update(releaseEvents)
        .set({
          startDate: utcStartDate,
          endDate: utcEndDate,
          location: location || null,
          timezone: tz,
          updatedAt: new Date(),
        })
        .where(eq(releaseEvents.prId, release.id))
    } else {
      await db.insert(releaseEvents).values({
        prId: release.id,
        startDate: utcStartDate,
        endDate: utcEndDate,
        location: location || null,
        timezone: tz,
      })
    }

    const event = await db.query.releaseEvents.findFirst({
      where: eq(releaseEvents.prId, release.id),
    })

    return NextResponse.json({ success: true, event })
  } catch (error) {
    console.error('[API] Error updating event:', error)
    return NextResponse.json({ error: 'Failed to update event' }, { status: 500 })
  }
}
