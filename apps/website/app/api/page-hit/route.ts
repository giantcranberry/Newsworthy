import { NextRequest, NextResponse } from 'next/server'
import { recordCrawlerHit } from '@/lib/record-page-hit'

export const runtime = 'nodejs'

type Body = {
  path?: string
  pageUrl?: string
}

/**
 * Async beacon / middleware target for crawler hit logging.
 * Classifies User-Agent server-side; only persists crawler visitors (seo / ai / other).
 */
export async function POST(request: NextRequest) {
  let body: Body = {}
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const path = typeof body.path === 'string' ? body.path : ''
  const pageUrl =
    typeof body.pageUrl === 'string'
      ? body.pageUrl
      : request.nextUrl.origin + path

  if (!path.startsWith('/news') && !path.startsWith('/curated')) {
    return NextResponse.json({ ok: false, error: 'path_not_allowed' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')
  const recorded = await recordCrawlerHit({ path, pageUrl, userAgent })

  return NextResponse.json({ ok: true, recorded })
}
