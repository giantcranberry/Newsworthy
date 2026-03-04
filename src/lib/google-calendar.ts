import { google } from 'googleapis'
import { db } from '@/db'
import { oauth } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

const PROVIDER = 'google_calendar'

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_ID!,
    process.env.GOOGLE_SECRET!,
    `${process.env.NEXT_PUBLIC_APP_URL}/api/google-calendar/callback`
  )
}

export function getGoogleCalendarAuthUrl(state: string): string {
  const client = getOAuth2Client()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
  })
}

export async function exchangeCodeForTokens(code: string) {
  const client = getOAuth2Client()
  const { tokens } = await client.getToken(code)
  return tokens
}

export async function getCalendarClient(userId: number) {
  const [row] = await db
    .select({ token: oauth.token })
    .from(oauth)
    .where(and(eq(oauth.userId, userId), eq(oauth.provider, PROVIDER)))
    .limit(1)

  if (!row?.token) return null

  const client = getOAuth2Client()
  client.setCredentials({ refresh_token: row.token })

  return google.calendar({ version: 'v3', auth: client })
}

export async function isGoogleCalendarConnected(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: oauth.id })
    .from(oauth)
    .where(and(eq(oauth.userId, userId), eq(oauth.provider, PROVIDER)))
    .limit(1)

  return !!row
}

interface CalendarEventInput {
  title: string
  description?: string | null
  eventDate: string
  eventTime?: string | null
}

function buildGoogleEventBody(event: CalendarEventInput) {
  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description || undefined,
  }

  if (event.eventTime) {
    // Timed event — 1 hour duration
    const startDateTime = `${event.eventDate}T${event.eventTime}:00`
    const startDate = new Date(startDateTime)
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000)

    body.start = { dateTime: startDate.toISOString(), timeZone: 'UTC' }
    body.end = { dateTime: endDate.toISOString(), timeZone: 'UTC' }
  } else {
    // All-day event
    body.start = { date: event.eventDate }
    body.end = { date: event.eventDate }
  }

  return body
}

export async function createGoogleEvent(
  userId: number,
  event: CalendarEventInput
): Promise<string | null> {
  try {
    const calendar = await getCalendarClient(userId)
    if (!calendar) return null

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: buildGoogleEventBody(event),
    })

    return res.data.id || null
  } catch (error) {
    console.error('[Google Calendar] Error creating event:', error)
    return null
  }
}

export async function updateGoogleEvent(
  userId: number,
  googleEventId: string,
  event: CalendarEventInput
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient(userId)
    if (!calendar) return false

    await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: buildGoogleEventBody(event),
    })

    return true
  } catch (error) {
    console.error('[Google Calendar] Error updating event:', error)
    return false
  }
}

export async function deleteGoogleEvent(
  userId: number,
  googleEventId: string
): Promise<boolean> {
  try {
    const calendar = await getCalendarClient(userId)
    if (!calendar) return false

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    })

    return true
  } catch (error) {
    console.error('[Google Calendar] Error deleting event:', error)
    return false
  }
}

export async function disconnectGoogleCalendar(userId: number): Promise<void> {
  await db
    .delete(oauth)
    .where(and(eq(oauth.userId, userId), eq(oauth.provider, PROVIDER)))
}
