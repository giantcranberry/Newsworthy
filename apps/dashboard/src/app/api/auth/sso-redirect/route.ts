import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createHmac } from 'crypto'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get('action') || 'login'
  const next = searchParams.get('next') || (action === 'logout' ? '/login' : '/dashboard')

  const websiteUrl = process.env.WEBSITE_URL
  const ssoSecret = process.env.SSO_SECRET

  console.log('[SSO Redirect]', { action, next, websiteUrl: !!websiteUrl, ssoSecret: !!ssoSecret })

  // Graceful fallback: if no WEBSITE_URL or SSO_SECRET, skip SSO bounce
  if (!websiteUrl || !ssoSecret) {
    console.log('[SSO Redirect] Missing env vars, skipping SSO bounce')
    return NextResponse.redirect(new URL(next, request.url))
  }

  // For login action, verify user has a valid session
  if (action === 'login') {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
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

  return NextResponse.redirect(callbackUrl.toString())
}
