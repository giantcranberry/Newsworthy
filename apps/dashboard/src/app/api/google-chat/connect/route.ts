import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSession } from '@/lib/auth'
import { db } from '@/db'
import { googleChatConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const session = await getEffectiveSession()
  const userId = parseInt(session?.user?.id || '0')
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { webhookUrl, spaceName } = body

  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 })
  }

  if (!webhookUrl.startsWith('https://chat.googleapis.com/')) {
    return NextResponse.json({ error: 'Invalid webhook URL. Must be a Google Chat webhook.' }, { status: 400 })
  }

  // Test the webhook with a greeting message
  try {
    const testResp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text: '\u2705 Newsworthy connected! You will receive notifications here.' }),
    })

    if (!testResp.ok) {
      return NextResponse.json({ error: 'Webhook test failed. Please check the URL.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not reach webhook URL. Please check the URL.' }, { status: 400 })
  }

  // Upsert: delete existing then insert
  await db.delete(googleChatConnections).where(eq(googleChatConnections.userId, userId))

  await db.insert(googleChatConnections).values({
    userId,
    spaceName: spaceName?.trim() || null,
    webhookUrl,
  })

  return NextResponse.json({ success: true })
}
