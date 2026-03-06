import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { getSlackConnection } from '@/lib/slack'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getSlackConnection(userId)

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    channelName: connection.channelName,
    teamName: connection.teamName,
  })
}
