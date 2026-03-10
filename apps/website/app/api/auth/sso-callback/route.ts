import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const token = searchParams.get('token')
  const next = searchParams.get('next')

  const ssoSecret = process.env.SSO_SECRET
  const dashboardUrl = process.env.DASHBOARD_URL

  // Default redirect if next is missing or invalid
  const fallbackUrl = dashboardUrl || 'https://app.newsworthyai.com/dashboard'

  console.log('[SSO Callback]', { hasToken: !!token, hasSsoSecret: !!ssoSecret, next, dashboardUrl })

  if (!token || !ssoSecret) {
    console.log('[SSO Callback] Missing token or secret')
    return NextResponse.redirect(next || fallbackUrl)
  }

  // Validate next URL to prevent open redirect
  const redirectUrl = next && dashboardUrl && next.startsWith(dashboardUrl) ? next : fallbackUrl

  try {
    // Split token into payload and signature
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) {
      return NextResponse.redirect(redirectUrl)
    }

    const payloadBase64 = token.substring(0, dotIndex)
    const signature = token.substring(dotIndex + 1)

    // Verify HMAC
    const expectedHmac = createHmac('sha256', ssoSecret).update(payloadBase64).digest('hex')
    if (signature !== expectedHmac) {
      return NextResponse.redirect(redirectUrl)
    }

    // Decode and parse payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

    // Reject if timestamp is older than 60 seconds
    if (Date.now() - payload.ts > 60_000) {
      return NextResponse.redirect(redirectUrl)
    }

    const response = NextResponse.redirect(redirectUrl)
    const isSecure = process.env.NODE_ENV === 'production'

    console.log('[SSO Callback] Payload:', payload, 'Redirect:', redirectUrl)

    if (payload.action === 'login') {
      response.cookies.set('nw_sso', '1', {
        maxAge: 86400, // 24 hours
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: isSecure,
      })
    } else if (payload.action === 'logout') {
      response.cookies.set('nw_sso', '', {
        maxAge: 0,
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: isSecure,
      })
    }

    return response
  } catch {
    // On any error, redirect without setting cookie
    return NextResponse.redirect(redirectUrl)
  }
}
