import { NextResponse } from 'next/server'
import { getCrawlerStatsLast24h } from '@/lib/crawler-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Live 24h crawler counts for the login stats bar. */
export async function GET() {
  const stats = await getCrawlerStatsLast24h()

  return NextResponse.json(stats, {
    headers: {
      'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40',
    },
  })
}
