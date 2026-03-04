import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { getGoogleChatConnection } from '@/lib/google-chat'

export async function GET() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const connection = await getGoogleChatConnection(userId)

  if (!connection) {
    return NextResponse.json({ connected: false })
  }

  return NextResponse.json({
    connected: true,
    spaceName: connection.spaceName,
  })
}
