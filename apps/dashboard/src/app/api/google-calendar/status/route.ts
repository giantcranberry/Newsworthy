import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { isGoogleCalendarConnected } from '@/lib/google-calendar'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connected = await isGoogleCalendarConnected(userId)
  return NextResponse.json({ connected })
}
