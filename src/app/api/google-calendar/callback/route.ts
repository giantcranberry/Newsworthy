import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { oauth } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { exchangeCodeForTokens } from '@/lib/google-calendar'

const PROVIDER = 'google_calendar'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  if (error) {
    return NextResponse.redirect(`${baseUrl}/calendar?gcal_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/calendar?gcal_error=missing_params`)
  }

  try {
    const userId = parseInt(Buffer.from(state, 'base64').toString('utf-8'))
    if (!userId || isNaN(userId)) {
      return NextResponse.redirect(`${baseUrl}/calendar?gcal_error=invalid_state`)
    }

    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${baseUrl}/calendar?gcal_error=no_refresh_token`)
    }

    // Upsert: delete existing row then insert
    await db
      .delete(oauth)
      .where(and(eq(oauth.userId, userId), eq(oauth.provider, PROVIDER)))

    await db.insert(oauth).values({
      userId,
      provider: PROVIDER,
      token: tokens.refresh_token,
    })

    return NextResponse.redirect(`${baseUrl}/calendar?gcal_connected=true`)
  } catch (err) {
    console.error('[Google Calendar] Callback error:', err)
    return NextResponse.redirect(`${baseUrl}/calendar?gcal_error=exchange_failed`)
  }
}
