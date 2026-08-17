import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createHmac } from 'crypto'

async function resolveLoginDestination(
  next: string,
  session: { user?: { id?: string | null } | null } | null
): Promise<string> {
  // Only rewrite the default post-login home; keep intentional deep links.
  if (next !== '/dashboard' && next !== '/') return next

  const userId = session?.user?.id ? Number(session.user.id) : NaN
  if (!Number.isFinite(userId)) return next === '/' ? '/dashboard' : next

  // Prefer DB over JWT so a stale/missing isAdmin flag can't send admins to /dashboard.
  const [row] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (row?.isAdmin) return '/admin'

  return next === '/' ? '/dashboard' : next
}

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
    next = await resolveLoginDestination(next, session)
  }

  console.log('[SSO Redirect]', { action, next, isLocalhost, websiteUrl: !!websiteUrl, ssoSecret: !!ssoSecret })

  // Graceful fallback: on localhost, or if no WEBSITE_URL / SSO_SECRET, skip SSO bounce
  if (isLocalhost || !websiteUrl || !ssoSecret) {
    console.log('[SSO Redirect] Skipping SSO bounce', { isLocalhost })
    return withExpandHint(NextResponse.redirect(new URL(next, request.url)))
  }

  // For login action, verify user has a valid session before the website SSO bounce.
  // If the session cookie isn't readable yet (occasional OAuth race), continue to
  // `next` instead of bouncing to /login — the dashboard layout will enforce auth.
  if (action === 'login' && !hasSessionUser && !isLocalhost && websiteUrl && ssoSecret) {
    console.warn('[SSO Redirect] No session after login; continuing to', next)
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
