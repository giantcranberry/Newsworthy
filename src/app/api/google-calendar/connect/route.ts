import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { getGoogleCalendarAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const state = Buffer.from(userId.toString()).toString('base64')
  const url = getGoogleCalendarAuthUrl(state)

  return NextResponse.redirect(url)
}
