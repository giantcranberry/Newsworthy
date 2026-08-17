import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createHmac } from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action') || 'login'
  let next = searchParams.get('next') || (action === 'logout' ? '/login' : '/dashboard')

  const websiteUrl = process.env.WEBSITE_URL
  const ssoSecret = process.env.SSO_SECRET

  // In local dev the SSO bounce would send us to the production website
  // (WEBSITE_URL comes from Doppler), which can't validate a localhost "next"
  // and falls back to the production dashboard/login. Stay local instead.
  const isLocalhost = ['localhost', '127.0.0.1'].includes(request.nextUrl.hostname)

  // On login, drop a one-shot hint so the dashboard shell starts with the
  // sidebar expanded regardless of a stale collapsed preference. Consumed and
  // cleared client-side on first render.
  const withExpandHint = (res: NextResponse) => {
    if (action === 'login') {
      res.cookies.set('nw-expand-nav', '1', {
        path: '/',
        maxAge: 120,
        httpOnly: false,
        sameSite: 'lax',
      })
    }
    return res
  }

  let hasSessionUser = false

  if (action === 'login') {
    const session = await auth()
    hasSessionUser = !!session?.user
    // Default post-login home for admins is /admin (not /dashboard).
    // Preserve intentional deep links other than /dashboard.
    if (next === '/dashboard' && (session?.user as any)?.isAdmin) {
      next = '/admin'
    }
  }

  console.log('[SSO Redirect]', { action, next, isLocalhost, websiteUrl: !!websiteUrl, ssoSecret: !!ssoSecret })

  // Graceful fallback: on localhost, or if no WEBSITE_URL / SSO_SECRET, skip SSO bounce
  if (isLocalhost || !websiteUrl || !ssoSecret) {
    console.log('[SSO Redirect] Skipping SSO bounce', { isLocalhost })
    return withExpandHint(NextResponse.redirect(new URL(next, request.url)))
  }

  // For login action, verify user has a valid session
  if (action === 'login' && !hasSessionUser) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Generate HMAC-signed token
  const payload = JSON.stringify({ ts: Date.now(), action })
  const payloadBase64 = Buffer.from(payload).toString('base64url')
  const hmac = createHmac('sha256', ssoSecret).update(payloadBase64).digest('hex')
  const token = `${payloadBase64}.${hmac}`

  // Build the absolute dashboard URL for the "next" redirect
  const dashboardUrl = `${request.nextUrl.origin}${next}`

  // Redirect to website's SSO callback
  const callbackUrl = new URL('/api/auth/sso-callback', websiteUrl)
  callbackUrl.searchParams.set('token', token)
  callbackUrl.searchParams.set('next', dashboardUrl)

  return withExpandHint(NextResponse.redirect(callbackUrl.toString()))
}
