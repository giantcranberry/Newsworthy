import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchGaOverview,
  fetchGaPropertyReport,
  hasGaCredentials,
  resolveGaProperties,
  type GaDateRange,
} from '@/lib/google-analytics'

const VALID_RANGES = new Set<GaDateRange>(['7d', '28d', '90d'])

export async function GET(req: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin

  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized - admin only' }, { status: 401 })
  }

  if (!hasGaCredentials()) {
    return NextResponse.json({
      configured: false,
      properties: [],
      setup: {
        missing: [
          !process.env.GA_CLIENT_EMAIL && 'GA_CLIENT_EMAIL',
          !process.env.GA_PRIVATE_KEY && 'GA_PRIVATE_KEY',
        ].filter(Boolean),
        serviceAccountEmail: process.env.GA_CLIENT_EMAIL || null,
      },
    })
  }

  const { searchParams } = new URL(req.url)
  const rangeParam = (searchParams.get('range') || '28d') as GaDateRange
  const range = VALID_RANGES.has(rangeParam) ? rangeParam : '28d'
  const propertyId = searchParams.get('propertyId')

  const resolved = await resolveGaProperties()

  if (resolved.properties.length === 0) {
    return NextResponse.json({
      configured: true,
      properties: [],
      discoveryError: resolved.discoveryError,
      serviceAccountEmail: process.env.GA_CLIENT_EMAIL || null,
      setup: {
        missing: [],
        serviceAccountEmail: process.env.GA_CLIENT_EMAIL || null,
        hint:
          resolved.discoveryError ||
          'Enable Google Analytics Admin API, grant Viewer on each GA4 property, or set GA_PROPERTIES.',
      },
    })
  }

  try {
    // Detail view for one property
    if (propertyId) {
      const selected =
        resolved.properties.find((p) => p.propertyId === propertyId) ||
        resolved.properties[0]
      const report = await fetchGaPropertyReport(selected, range)
      return NextResponse.json({
        configured: true,
        source: resolved.source,
        properties: resolved.properties.map((p) => ({
          label: p.label,
          propertyId: p.propertyId,
          accountName: p.accountName,
        })),
        report,
        fetchedAt: Date.now(),
      })
    }

    // Overview across all properties
    const overview = await fetchGaOverview(resolved.properties, range)
    return NextResponse.json({
      configured: true,
      source: resolved.source,
      properties: resolved.properties.map((p) => ({
        label: p.label,
        propertyId: p.propertyId,
        accountName: p.accountName,
      })),
      overview,
      fetchedAt: Date.now(),
    })
  } catch (error: any) {
    console.error('[GA Analytics]', error)
    const message =
      error?.errors?.[0]?.message ||
      error?.message ||
      'Failed to fetch Google Analytics data'
    return NextResponse.json(
      {
        configured: true,
        source: resolved.source,
        properties: resolved.properties.map((p) => ({
          label: p.label,
          propertyId: p.propertyId,
          accountName: p.accountName,
        })),
        error: message,
        serviceAccountEmail: process.env.GA_CLIENT_EMAIL || null,
      },
      { status: 502 }
    )
  }
}
