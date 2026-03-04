import { NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { disconnectSlack } from '@/lib/slack'

export async function POST() {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await disconnectSlack(userId)

  return NextResponse.json({ success: true })
}
