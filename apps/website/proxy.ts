import { NextRequest, NextResponse, after } from 'next/server'
import { LIKELY_BOT_UA } from '@/lib/likely-bot-ua'

/**
 * For /news and /curated, async-log likely crawlers via /api/page-hit.
 * Complements the client beacon (many bots never run JS).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/news') && !pathname.startsWith('/curated')) {
    return NextResponse.next()
  }

  const ua = request.headers.get('user-agent') ?? ''
  if (!LIKELY_BOT_UA.test(ua)) {
    return NextResponse.next()
  }

  const pageUrl = request.nextUrl.href
  const origin = request.nextUrl.origin

  after(async () => {
    try {
      await fetch(`${origin}/api/page-hit`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': ua,
        },
        body: JSON.stringify({ path: pathname, pageUrl }),
      })
    } catch {
      // never block the request
    }
  })

  return NextResponse.next()
}

export const config = {
  matcher: ['/news/:path*', '/curated/:path*'],
}
