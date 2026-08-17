import { google, analyticsdata_v1beta } from 'googleapis'

export type GaDateRange = '7d' | '28d' | '90d'

export interface GaPropertyConfig {
  label: string
  propertyId: string
  accountName?: string
}

export interface GaTimeseriesPoint {
  date: string
  activeUsers: number
  newUsers: number
  sessions: number
  pageViews: number
}

export interface GaTopPage {
  path: string
  pageViews: number
  activeUsers: number
}

export interface GaChannel {
  channel: string
  sessions: number
  activeUsers: number
}

export interface GaPropertyTotals {
  activeUsers: number
  sessions: number
  pageViews: number
  engagedSessions: number
  averageSessionDuration: number
  bounceRate: number
}

export interface GaRealtimePage {
  path: string
  activeUsers: number
}

export interface GaRealtimeLocation {
  country: string
  city: string
  activeUsers: number
}

export interface GaRealtimeSnapshot {
  activeUsers: number | null
  pages: GaRealtimePage[]
  locations: GaRealtimeLocation[]
}

export interface GaPropertySummary {
  propertyId: string
  label: string
  accountName?: string
  range: GaDateRange
  startDate: string
  endDate: string
  totals: Pick<GaPropertyTotals, 'activeUsers' | 'sessions' | 'pageViews'>
  previousTotals: Pick<GaPropertyTotals, 'activeUsers' | 'sessions' | 'pageViews'>
  realtimeUsers: number | null
  realtimePages: GaRealtimePage[]
  realtimeLocations: GaRealtimeLocation[]
  error?: string
}

export interface GaPropertyReport {
  propertyId: string
  label: string
  range: GaDateRange
  startDate: string
  endDate: string
  totals: GaPropertyTotals
  previousTotals: Pick<GaPropertyTotals, 'activeUsers' | 'sessions' | 'pageViews'>
  timeseries: GaTimeseriesPoint[]
  topPages: GaTopPage[]
  channels: GaChannel[]
  realtimeUsers: number | null
  realtimePages: GaRealtimePage[]
  realtimeLocations: GaRealtimeLocation[]
}

const RANGE_DAYS: Record<GaDateRange, number> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
}

function formatYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function rangeToDates(range: GaDateRange): {
  startDate: string
  endDate: string
  prevStartDate: string
  prevEndDate: string
} {
  const days = RANGE_DAYS[range]
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))

  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - (days - 1))

  return {
    startDate: formatYmd(start),
    endDate: formatYmd(end),
    prevStartDate: formatYmd(prevStart),
    prevEndDate: formatYmd(prevEnd),
  }
}

function metricValue(
  row: analyticsdata_v1beta.Schema$Row | undefined,
  index: number
): number {
  const raw = row?.metricValues?.[index]?.value
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function dimensionValue(
  row: analyticsdata_v1beta.Schema$Row | undefined,
  index: number
): string {
  return row?.dimensionValues?.[index]?.value || ''
}

/** Always excluded; extend via GA_PROPERTIES_EXCLUDE=id1,id2 */
const DEFAULT_EXCLUDED_PROPERTY_IDS = [
  '550071728', // EncinoLabs
  '352115855', // newswriter
]

function getExcludedPropertyIds(): Set<string> {
  const fromEnv = (process.env.GA_PROPERTIES_EXCLUDE || '')
    .split(',')
    .map((id) => id.trim().replace(/^properties\//, ''))
    .filter((id) => /^\d+$/.test(id))

  return new Set([...DEFAULT_EXCLUDED_PROPERTY_IDS, ...fromEnv])
}

function withoutExcluded(properties: GaPropertyConfig[]): GaPropertyConfig[] {
  const excluded = getExcludedPropertyIds()
  return properties.filter((p) => !excluded.has(p.propertyId))
}

/** Parse `Label:123456789,Other Label:987654321` */
export function getGaPropertiesFromEnv(): GaPropertyConfig[] {
  const raw = process.env.GA_PROPERTIES?.trim()
  if (!raw) return []

  return withoutExcluded(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const colon = part.lastIndexOf(':')
        if (colon <= 0) return null
        const label = part.slice(0, colon).trim()
        const propertyId = part.slice(colon + 1).trim().replace(/^properties\//, '')
        if (!label || !/^\d+$/.test(propertyId)) return null
        return { label, propertyId }
      })
      .filter((p): p is GaPropertyConfig => !!p)
  )
}

export function hasGaCredentials(): boolean {
  return !!(process.env.GA_CLIENT_EMAIL && process.env.GA_PRIVATE_KEY)
}

function getJwtAuth() {
  const email = process.env.GA_CLIENT_EMAIL
  const privateKey = process.env.GA_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !privateKey) {
    throw new Error('GA_CLIENT_EMAIL and GA_PRIVATE_KEY are required')
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

function getDataClient() {
  return google.analyticsdata({ version: 'v1beta', auth: getJwtAuth() })
}

function getAdminClient() {
  return google.analyticsadmin({ version: 'v1beta', auth: getJwtAuth() })
}

/** Discover GA4 properties the service account can access via Admin API. */
export async function discoverGaProperties(): Promise<GaPropertyConfig[]> {
  const admin = getAdminClient()
  const properties: GaPropertyConfig[] = []
  let pageToken: string | undefined

  do {
    const res = await admin.accountSummaries.list({
      pageSize: 200,
      pageToken,
    })

    for (const account of res.data.accountSummaries || []) {
      const accountName = account.displayName || account.account || undefined
      for (const prop of account.propertySummaries || []) {
        const raw = prop.property || ''
        const propertyId = raw.replace(/^properties\//, '')
        if (!/^\d+$/.test(propertyId)) continue
        properties.push({
          label: prop.displayName || propertyId,
          propertyId,
          accountName,
        })
      }
    }

    pageToken = res.data.nextPageToken || undefined
  } while (pageToken)

  return withoutExcluded(properties).sort((a, b) => a.label.localeCompare(b.label))
}

export async function resolveGaProperties(): Promise<{
  properties: GaPropertyConfig[]
  source: 'env' | 'discovery' | 'none'
  discoveryError?: string
}> {
  const fromEnv = getGaPropertiesFromEnv()
  if (fromEnv.length > 0) {
    return { properties: fromEnv, source: 'env' }
  }

  try {
    const discovered = await discoverGaProperties()
    if (discovered.length === 0) {
      return {
        properties: [],
        source: 'none',
        discoveryError:
          'No GA4 properties found. Add the service account as Viewer on each property, or set GA_PROPERTIES.',
      }
    }
    return { properties: discovered, source: 'discovery' }
  } catch (error: any) {
    const message =
      error?.errors?.[0]?.message ||
      error?.message ||
      'Failed to discover GA properties'
    return { properties: [], source: 'none', discoveryError: message }
  }
}

const EMPTY_REALTIME: GaRealtimeSnapshot = {
  activeUsers: null,
  pages: [],
  locations: [],
}

async function fetchRealtimeSnapshot(
  client: ReturnType<typeof getDataClient>,
  propertyName: string
): Promise<GaRealtimeSnapshot> {
  const [usersResult, pagesResult, locationsResult] = await Promise.allSettled([
    client.properties.runRealtimeReport({
      property: propertyName,
      requestBody: { metrics: [{ name: 'activeUsers' }] },
    }),
    client.properties.runRealtimeReport({
      property: propertyName,
      requestBody: {
        dimensions: [{ name: 'unifiedPagePathScreen' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: '10',
      },
    }),
    client.properties.runRealtimeReport({
      property: propertyName,
      requestBody: {
        dimensions: [{ name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: '10',
      },
    }),
  ])

  if (
    usersResult.status === 'rejected' &&
    pagesResult.status === 'rejected' &&
    locationsResult.status === 'rejected'
  ) {
    return EMPTY_REALTIME
  }

  const activeUsers =
    usersResult.status === 'fulfilled'
      ? metricValue(usersResult.value.data.rows?.[0], 0)
      : null

  const pages: GaRealtimePage[] =
    pagesResult.status === 'fulfilled'
      ? (pagesResult.value.data.rows || []).map((row) => ({
          path: dimensionValue(row, 0) || '/',
          activeUsers: metricValue(row, 0),
        }))
      : []

  const locations: GaRealtimeLocation[] =
    locationsResult.status === 'fulfilled'
      ? (locationsResult.value.data.rows || []).map((row) => ({
          country: dimensionValue(row, 0) || 'Unknown',
          city: dimensionValue(row, 1) || '',
          activeUsers: metricValue(row, 0),
        }))
      : []

  return { activeUsers, pages, locations }
}

export async function fetchGaPropertySummary(
  property: GaPropertyConfig,
  range: GaDateRange
): Promise<GaPropertySummary> {
  const client = getDataClient()
  const propertyName = `properties/${property.propertyId}`
  const { startDate, endDate, prevStartDate, prevEndDate } = rangeToDates(range)

  try {
    const [totalsRes, prevRes, realtime] = await Promise.all([
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
          ],
        },
      }),
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
          ],
        },
      }),
      fetchRealtimeSnapshot(client, propertyName),
    ])

    const totalsRow = totalsRes.data.rows?.[0]
    const prevRow = prevRes.data.rows?.[0]

    return {
      propertyId: property.propertyId,
      label: property.label,
      accountName: property.accountName,
      range,
      startDate,
      endDate,
      totals: {
        activeUsers: metricValue(totalsRow, 0),
        sessions: metricValue(totalsRow, 1),
        pageViews: metricValue(totalsRow, 2),
      },
      previousTotals: {
        activeUsers: metricValue(prevRow, 0),
        sessions: metricValue(prevRow, 1),
        pageViews: metricValue(prevRow, 2),
      },
      realtimeUsers: realtime.activeUsers,
      realtimePages: realtime.pages,
      realtimeLocations: realtime.locations,
    }
  } catch (error: any) {
    return {
      propertyId: property.propertyId,
      label: property.label,
      accountName: property.accountName,
      range,
      startDate,
      endDate,
      totals: { activeUsers: 0, sessions: 0, pageViews: 0 },
      previousTotals: { activeUsers: 0, sessions: 0, pageViews: 0 },
      realtimeUsers: null,
      realtimePages: [],
      realtimeLocations: [],
      error:
        error?.errors?.[0]?.message ||
        error?.message ||
        'Failed to load property',
    }
  }
}

export async function fetchGaOverview(
  properties: GaPropertyConfig[],
  range: GaDateRange
): Promise<GaPropertySummary[]> {
  return Promise.all(properties.map((p) => fetchGaPropertySummary(p, range)))
}

export async function fetchGaPropertyReport(
  property: GaPropertyConfig,
  range: GaDateRange
): Promise<GaPropertyReport> {
  const client = getDataClient()
  const propertyName = `properties/${property.propertyId}`
  const { startDate, endDate, prevStartDate, prevEndDate } = rangeToDates(range)

  const [totalsRes, prevRes, timeseriesRes, pagesRes, channelsRes, realtime] =
    await Promise.all([
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'engagedSessions' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        },
      }),
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate: prevStartDate, endDate: prevEndDate }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
          ],
        },
      }),
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
        },
      }),
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'pagePath' }],
          metrics: [{ name: 'screenPageViews' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
          limit: '10',
        },
      }),
      client.properties.runReport({
        property: propertyName,
        requestBody: {
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
          metrics: [{ name: 'sessions' }, { name: 'activeUsers' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: '8',
        },
      }),
      fetchRealtimeSnapshot(client, propertyName),
    ])

  const totalsRow = totalsRes.data.rows?.[0]
  const prevRow = prevRes.data.rows?.[0]

  const timeseries: GaTimeseriesPoint[] = (timeseriesRes.data.rows || []).map((row) => {
    const raw = dimensionValue(row, 0)
    const date =
      raw.length === 8
        ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
        : raw
    return {
      date,
      activeUsers: metricValue(row, 0),
      newUsers: metricValue(row, 1),
      sessions: metricValue(row, 2),
      pageViews: metricValue(row, 3),
    }
  })

  const topPages: GaTopPage[] = (pagesRes.data.rows || []).map((row) => ({
    path: dimensionValue(row, 0) || '/',
    pageViews: metricValue(row, 0),
    activeUsers: metricValue(row, 1),
  }))

  const channels: GaChannel[] = (channelsRes.data.rows || []).map((row) => ({
    channel: dimensionValue(row, 0) || 'Unknown',
    sessions: metricValue(row, 0),
    activeUsers: metricValue(row, 1),
  }))

  return {
    propertyId: property.propertyId,
    label: property.label,
    range,
    startDate,
    endDate,
    totals: {
      activeUsers: metricValue(totalsRow, 0),
      sessions: metricValue(totalsRow, 1),
      pageViews: metricValue(totalsRow, 2),
      engagedSessions: metricValue(totalsRow, 3),
      averageSessionDuration: metricValue(totalsRow, 4),
      bounceRate: metricValue(totalsRow, 5),
    },
    previousTotals: {
      activeUsers: metricValue(prevRow, 0),
      sessions: metricValue(prevRow, 1),
      pageViews: metricValue(prevRow, 2),
    },
    timeseries,
    topPages,
    channels,
    realtimeUsers: realtime.activeUsers,
    realtimePages: realtime.pages,
    realtimeLocations: realtime.locations,
  }
}
