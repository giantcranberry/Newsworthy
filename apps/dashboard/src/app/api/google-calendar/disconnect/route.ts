import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { disconnectGoogleCalendar } from '@/lib/google-calendar'

export async function POST() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await disconnectGoogleCalendar(userId)
  return NextResponse.json({ success: true })
}
