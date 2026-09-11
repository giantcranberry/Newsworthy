/**
 * Google Analytics panels, backed by the same module the admin analytics page
 * uses. That module only depends on `googleapis` and `process.env`, so it runs
 * unchanged outside Next.js and the TUI can import it directly rather than
 * keeping a second copy of the GA4 query logic in sync.
 */

import {
  fetchGaOverview,
  fetchGaPropertyReport,
  hasGaCredentials,
  resolveGaProperties,
  type GaDateRange,
  type GaPropertyConfig,
  type GaPropertyReport,
  type GaPropertySummary,
  type GaRealtimeLocation,
  type GaRealtimePage,
} from '../../dashboard/src/lib/google-analytics.ts'

export type {
  GaDateRange,
  GaPropertyConfig,
  GaPropertyReport,
  GaPropertySummary,
  GaRealtimeLocation,
  GaRealtimePage,
}

export const GA_RANGES: GaDateRange[] = ['7d', '28d', '90d']

/** A live page or location row, tagged with the property it came from. */
export interface TaggedRealtimePage extends GaRealtimePage {
  propertyLabel: string
}

export interface AnalyticsSnapshot {
  configured: boolean
  properties: GaPropertyConfig[]
  overview: GaPropertySummary[]
  /** Set only while a single property is selected. */
  report: GaPropertyReport | null
  selectedPropertyId: string | null
  range: GaDateRange
  /** Live users across every property, or for the selected one. */
  liveUsers: number | null
  livePages: TaggedRealtimePage[]
  liveLocations: GaRealtimeLocation[]
  fetchedAt: number
  discoveryError: string | null
}

export function nextRange(range: GaDateRange): GaDateRange {
  return GA_RANGES[(GA_RANGES.indexOf(range) + 1) % GA_RANGES.length]
}

/** Merge the per-property live pages into one leaderboard. */
function mergeLivePages(summaries: GaPropertySummary[]): TaggedRealtimePage[] {
  const pages: TaggedRealtimePage[] = []
  for (const summary of summaries) {
    for (const page of summary.realtimePages) {
      if (page.activeUsers <= 0) continue
      pages.push({ ...page, propertyLabel: summary.label })
    }
  }
  return pages.sort((a, b) => b.activeUsers - a.activeUsers).slice(0, 12)
}

/** Merge live locations across properties, summing the same city twice over. */
function mergeLiveLocations(summaries: GaPropertySummary[]): GaRealtimeLocation[] {
  const byPlace = new Map<string, GaRealtimeLocation>()
  for (const summary of summaries) {
    for (const location of summary.realtimeLocations) {
      if (location.activeUsers <= 0) continue
      const key = `${location.country}|${location.city}`
      const existing = byPlace.get(key)
      if (existing) existing.activeUsers += location.activeUsers
      else byPlace.set(key, { ...location })
    }
  }
  return [...byPlace.values()]
    .sort((a, b) => b.activeUsers - a.activeUsers)
    .slice(0, 12)
}

function sumLiveUsers(summaries: GaPropertySummary[]): number | null {
  const known = summaries.filter((summary) => summary.realtimeUsers != null)
  if (known.length === 0) return null
  return known.reduce((total, summary) => total + (summary.realtimeUsers ?? 0), 0)
}

export class AnalyticsStore {
  private properties: GaPropertyConfig[] | null = null
  private discoveryError: string | null = null

  get isConfigured(): boolean {
    return hasGaCredentials()
  }

  /** Property discovery costs an Admin API round trip, so it is cached. */
  private async loadProperties(force: boolean): Promise<GaPropertyConfig[]> {
    if (this.properties && !force) return this.properties
    const resolved = await resolveGaProperties()
    this.properties = resolved.properties
    this.discoveryError = resolved.discoveryError ?? null
    return this.properties
  }

  async refresh(options: {
    range: GaDateRange
    selectedPropertyId: string | null
    full?: boolean
  }): Promise<AnalyticsSnapshot> {
    if (!this.isConfigured) {
      return {
        configured: false,
        properties: [],
        overview: [],
        report: null,
        selectedPropertyId: null,
        range: options.range,
        liveUsers: null,
        livePages: [],
        liveLocations: [],
        fetchedAt: Date.now(),
        discoveryError: null,
      }
    }

    const properties = await this.loadProperties(options.full === true)

    if (properties.length === 0) {
      return {
        configured: true,
        properties: [],
        overview: [],
        report: null,
        selectedPropertyId: null,
        range: options.range,
        liveUsers: null,
        livePages: [],
        liveLocations: [],
        fetchedAt: Date.now(),
        discoveryError: this.discoveryError,
      }
    }

    const selected = options.selectedPropertyId
      ? properties.find((property) => property.propertyId === options.selectedPropertyId)
      : undefined

    const [overview, report] = await Promise.all([
      fetchGaOverview(properties, options.range),
      selected ? fetchGaPropertyReport(selected, options.range) : Promise.resolve(null),
    ])

    // With one property in focus, the live panels follow it rather than the
    // whole account, matching the web page's detail view.
    const scoped = selected
      ? overview.filter((summary) => summary.propertyId === selected.propertyId)
      : overview

    return {
      configured: true,
      properties,
      overview,
      report,
      selectedPropertyId: selected?.propertyId ?? null,
      range: options.range,
      liveUsers: sumLiveUsers(scoped),
      livePages: mergeLivePages(scoped),
      liveLocations: mergeLiveLocations(scoped),
      fetchedAt: Date.now(),
      discoveryError: this.discoveryError,
    }
  }
}
