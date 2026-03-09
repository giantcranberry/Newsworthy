import { NextResponse } from 'next/server'

const DASHBOARD_AGENT_CARD_URL = 'https://app.newsworthyai.com/.well-known/agent-card.json'

export async function GET() {
  try {
    const res = await fetch(DASHBOARD_AGENT_CARD_URL, {
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch agent card' },
        { status: 502 }
      )
    }

    const agentCard = await res.json()

    return NextResponse.json(agentCard, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Agent card unavailable' },
      { status: 502 }
    )
  }
}
