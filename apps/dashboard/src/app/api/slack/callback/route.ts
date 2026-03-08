import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { slackConnections } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { exchangeSlackCode } from '@/lib/slack'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.newsworthyai.com'
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${appUrl}/profile?slack_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/profile?slack_error=missing_params`)
  }

  let userId: number
  try {
    userId = parseInt(Buffer.from(state, 'base64').toString())
    if (isNaN(userId) || userId <= 0) throw new Error('Invalid user ID')
  } catch {
    return NextResponse.redirect(`${appUrl}/profile?slack_error=invalid_state`)
  }

  try {
    const result = await exchangeSlackCode(code)

    // Upsert: delete existing connection for this user, then insert new one
    await db.delete(slackConnections).where(eq(slackConnections.userId, userId))

    await db.insert(slackConnections).values({
      userId,
      teamId: result.teamId,
      teamName: result.teamName,
      channelId: result.channelId,
      channelName: result.channelName,
      webhookUrl: result.webhookUrl,
      botToken: result.botToken,
    })

    return NextResponse.redirect(`${appUrl}/profile?slack_connected=true`)
  } catch (err) {
    console.error('[Slack] OAuth callback error:', err)
    return NextResponse.redirect(`${appUrl}/profile?slack_error=exchange_failed`)
  }
}
