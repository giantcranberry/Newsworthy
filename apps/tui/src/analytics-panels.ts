/** Renderers for the Google Analytics tab. */

import {
  axisLabels,
  background,
  backgroundBar,
  barChart,
  bold,
  cell,
  color,
  columns,
  dim,
  distributeWidths,
  hbar,
  padStart,
  sparkline,
  splitWidth,
  truncate,
  type Paint,
} from './ui.ts'
import { delta } from './format.ts'
import type {
  AnalyticsSnapshot,
  GaPropertyReport,
  GaPropertySummary,
  GaRealtimeLocation,
  TaggedRealtimePage,
} from './analytics.ts'

const BLANK = ''

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en-US')

function count(value: number): string {
  return plain.format(Math.round(value))
}

function shortCount(value: number): string {
  return Math.abs(value) >= 10_000 ? compact.format(value) : plain.format(Math.round(value))
}

function deltaText(current: number, previous: number): string {
  const change = delta(current, previous)
  if (change.direction === 'up') return color.green(`▲ ${change.text}`)
  if (change.direction === 'down') return color.red(`▼ ${change.text}`)
  return dim(color.muted(`  ${change.text}`))
}

function duration(seconds: number): string {
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  return minutes > 0 ? `${minutes}m ${total % 60}s` : `${total}s`
}

/** Shown instead of every panel when GA is not usable. */
export function analyticsSetupBody(
  snapshot: AnalyticsSnapshot | null,
  error: string | null,
  width: number,
): string[] | null {
  const inner = width - 2

  if (error) {
    return [BLANK, ` ${color.red(truncate(error, inner - 1))}`, BLANK]
  }
  if (!snapshot) {
    return [BLANK, ` ${color.muted('Loading Google Analytics…')}`, BLANK]
  }
  if (!snapshot.configured) {
    return [
      BLANK,
      ` ${color.amber('Google Analytics is not configured.')}`,
      ` ${color.muted('Set GA_CLIENT_EMAIL and GA_PRIVATE_KEY, then restart.')}`,
      BLANK,
    ]
  }
  if (snapshot.properties.length === 0) {
    return [
      BLANK,
      ` ${color.amber('No GA4 properties are visible to this service account.')}`,
      ...(snapshot.discoveryError
        ? [` ${color.muted(truncate(snapshot.discoveryError, inner - 1))}`]
        : []),
      ` ${dim(color.faint('Grant it Viewer on each property, or set GA_PROPERTIES.'))}`,
      BLANK,
    ]
  }
  return null
}

/** Live users now, with the busiest pages and places. */
export function realtimeBody(snapshot: AnalyticsSnapshot, width: number): string[] {
  const inner = width - 2
  const scope = snapshot.selectedPropertyId
    ? snapshot.properties.find((p) => p.propertyId === snapshot.selectedPropertyId)?.label ??
      'this property'
    : 'all properties'

  const headline =
    snapshot.liveUsers == null
      ? color.muted('Live user count unavailable')
      : `${bold(color.green(count(snapshot.liveUsers)))} ${color.muted(
          `${snapshot.liveUsers === 1 ? 'person is' : 'people are'} on ${scope} right now`,
        )}`

  if (snapshot.livePages.length === 0 && snapshot.liveLocations.length === 0) {
    return [BLANK, ` ${headline}`, BLANK, ` ${dim(color.faint('No live activity.'))}`, BLANK]
  }

  const [pageWidth, placeWidth] = splitWidth(inner - 1, 2, 2)
  const pages = livePagesBlock(snapshot.livePages, pageWidth, !snapshot.selectedPropertyId)
  const places = liveLocationsBlock(snapshot.liveLocations, placeWidth)

  return [BLANK, ` ${headline}`, BLANK, ...columns([pages, places], [pageWidth, placeWidth], 2), BLANK]
}

function livePagesBlock(
  pages: TaggedRealtimePage[],
  width: number,
  showProperty: boolean,
): string[] {
  const usersWidth = 5
  const propertyWidth = showProperty ? 16 : 0
  const pathWidth = Math.max(10, width - 2 - usersWidth - propertyWidth - (showProperty ? 2 : 1))

  const rows = pages.slice(0, 8).map((page) => {
    const parts = [
      cell(page.path || '/', pathWidth, { paint: color.text }),
      ...(showProperty
        ? [cell(page.propertyLabel, propertyWidth, { paint: color.faint })]
        : []),
      cell(count(page.activeUsers), usersWidth, { align: 'right', paint: color.green }),
    ]
    return ` ${parts.join(' ')}`
  })

  return [
    ` ${dim(color.faint('LIVE PAGES'))}`,
    ...(rows.length > 0 ? rows : [` ${dim(color.faint('No live page activity'))}`]),
  ]
}

function liveLocationsBlock(locations: GaRealtimeLocation[], width: number): string[] {
  const usersWidth = 5
  const placeWidth = Math.max(10, width - 2 - usersWidth - 1)

  const rows = locations.slice(0, 8).map((location) => {
    const place = location.city ? `${location.city}, ${location.country}` : location.country
    return (
      ' ' +
      [
        cell(place, placeWidth, { paint: color.text }),
        cell(count(location.activeUsers), usersWidth, { align: 'right', paint: color.green }),
      ].join(' ')
    )
  })

  return [
    ` ${dim(color.faint('LIVE LOCATIONS'))}`,
    ...(rows.length > 0 ? rows : [` ${dim(color.faint('No live location activity'))}`]),
  ]
}

/** One row per GA4 property, with the selected one marked. */
export function propertiesBody(snapshot: AnalyticsSnapshot, width: number): string[] {
  const inner = width - 2
  const liveWidth = 6
  const metricWidth = 11
  const deltaWidth = 9
  const gaps = 5
  const labelWidth = Math.max(
    14,
    inner - 3 - liveWidth - metricWidth * 3 - deltaWidth - gaps,
  )

  const header =
    '   ' +
    [
      cell('PROPERTY', labelWidth),
      cell('LIVE', liveWidth, { align: 'right' }),
      cell('USERS', metricWidth, { align: 'right' }),
      cell('vs PREV', deltaWidth, { align: 'right' }),
      cell('SESSIONS', metricWidth, { align: 'right' }),
      cell('VIEWS', metricWidth, { align: 'right' }),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  // The bar behind each row is scaled against the busiest property, and the
  // shading alternates so a row can be followed across to the far column.
  const maxUsers = Math.max(
    ...snapshot.overview.map((summary) => summary.totals.activeUsers),
    0,
  )

  const rows = snapshot.overview.map((summary, index) => {
    const selected = summary.propertyId === snapshot.selectedPropertyId
    const marker = selected ? color.cyan('▸ ') : '  '
    const labelPaint: Paint = selected ? color.cyan : color.text
    const stripe: Paint = index % 2 === 1 ? background.stripe : (text) => text
    const barPaint: Paint = index % 2 === 1 ? background.barAlt : background.bar
    const barCells =
      maxUsers > 0 ? Math.round((summary.totals.activeUsers / maxUsers) * inner) : 0

    if (summary.error) {
      return backgroundBar(
        ` ${marker}` +
          cell(summary.label, labelWidth, { paint: labelPaint }) +
          ' ' +
          color.red(truncate(summary.error, inner - labelWidth - 6)),
        inner,
        0,
        barPaint,
        stripe,
      )
    }

    const change = delta(summary.totals.activeUsers, summary.previousTotals.activeUsers)
    const changePaint =
      change.direction === 'up'
        ? color.green
        : change.direction === 'down'
          ? color.red
          : color.faint

    const line =
      ` ${marker}` +
      [
        cell(summary.label, labelWidth, { paint: labelPaint }),
        cell(
          summary.realtimeUsers ? count(summary.realtimeUsers) : '·',
          liveWidth,
          { align: 'right', paint: summary.realtimeUsers ? color.green : color.faint },
        ),
        cell(count(summary.totals.activeUsers), metricWidth, {
          align: 'right',
          paint: color.text,
        }),
        cell(change.text, deltaWidth, { align: 'right', paint: changePaint }),
        cell(count(summary.totals.sessions), metricWidth, {
          align: 'right',
          paint: color.muted,
        }),
        cell(count(summary.totals.pageViews), metricWidth, {
          align: 'right',
          paint: color.muted,
        }),
      ].join(' ')

    return backgroundBar(line, inner, barCells, barPaint, stripe)
  })

  const hint = snapshot.selectedPropertyId
    ? ' press n or N to change property, 0 for all'
    : ' press n to focus one property'

  return [BLANK, header, ...rows, BLANK, ` ${dim(color.faint(hint.trim()))}`, BLANK]
}

function statTile(label: string, value: string, paint: Paint, width: number): string[] {
  return [
    ` ${paint('▐')} ${dim(color.faint(label.toUpperCase()))}`,
    ` ${paint('▐')} ${bold(paint(truncate(value, width - 4)))}`,
  ]
}

export function reportTotalsBody(report: GaPropertyReport, width: number): string[] {
  const inner = width - 2
  const widths = splitWidth(inner - 1, 3, 2)

  const first = columns(
    [
      statTile('Active users', count(report.totals.activeUsers), color.blue, widths[0]),
      statTile('Sessions', count(report.totals.sessions), color.green, widths[1]),
      statTile('Page views', count(report.totals.pageViews), color.purple, widths[2]),
    ],
    widths,
    2,
  )

  const second = columns(
    [
      statTile(
        'Engaged sessions',
        count(report.totals.engagedSessions),
        color.cyan,
        widths[0],
      ),
      statTile(
        'Avg session',
        duration(report.totals.averageSessionDuration),
        color.amber,
        widths[1],
      ),
      statTile(
        'Bounce rate',
        `${(report.totals.bounceRate * 100).toFixed(1)}%`,
        color.violet,
        widths[2],
      ),
    ],
    widths,
    2,
  )

  const comparison =
    ` ${dim(color.faint(`${report.startDate} to ${report.endDate}`))}` +
    `  ${dim(color.faint('users vs previous period'))} ${deltaText(
      report.totals.activeUsers,
      report.previousTotals.activeUsers,
    )}`

  return [BLANK, ...first, BLANK, ...second, BLANK, comparison, BLANK]
}

/** Daily active users as bars, with page views as a sparkline beneath. */
export function reportTrendBody(
  report: GaPropertyReport,
  width: number,
  height: number,
): string[] {
  const inner = width - 2
  const points = report.timeseries
  if (points.length === 0) {
    return [BLANK, ` ${dim(color.faint('No daily data in this range.'))}`, BLANK]
  }

  const gutter = 9
  const plotWidth = Math.max(10, inner - gutter - 4)
  const shown = points.length <= plotWidth ? points : points.slice(-plotWidth)
  const widths = distributeWidths(plotWidth, shown.length)
  const maxUsers = Math.max(...shown.map((point) => point.activeUsers), 0)

  const bars = barChart(
    shown.map((point) => point.activeUsers),
    height,
    color.blue,
    widths,
  )

  const gutterLabel = (text: string) => padStart(dim(color.faint(text)), gutter)
  const rows = bars.map((row, index) => {
    let label = gutterLabel('')
    if (index === 0) label = gutterLabel(shortCount(maxUsers))
    else if (index === Math.floor(height / 2)) label = gutterLabel(shortCount(maxUsers / 2))
    return ` ${label} ${color.faint('│')}${row}`
  })

  const shortDate = (value: string) => value.slice(5).replace('-', '/')
  const labels = axisLabels(
    shortDate(shown[0]?.date ?? ''),
    shortDate(shown[Math.floor(shown.length / 2)]?.date ?? ''),
    shortDate(shown[shown.length - 1]?.date ?? ''),
    plotWidth,
  )

  const totalUsers = shown.reduce((sum, point) => sum + point.activeUsers, 0)
  const totalNew = shown.reduce((sum, point) => sum + point.newUsers, 0)

  return [
    BLANK,
    ` ${color.muted(`${shown.length} days`)}  ${bold(color.text(count(totalUsers)))} ${color.muted(
      'active users',
    )} ${dim(color.faint('·'))} ${color.text(count(totalNew))} ${color.muted('new')}`,
    BLANK,
    ...rows,
    ` ${gutterLabel('0')} ${color.faint('└' + '─'.repeat(plotWidth))}`,
    ' '.repeat(gutter + 3) + dim(color.faint(labels)),
    BLANK,
    ` ${gutterLabel('views')} ${color.faint('│')}${sparkline(shown.map((point) => point.pageViews), color.amber, widths)}`,
    BLANK,
  ]
}

export function channelsBody(report: GaPropertyReport, width: number): string[] {
  const inner = width - 2
  if (report.channels.length === 0) {
    return [BLANK, ` ${dim(color.faint('No channel data.'))}`, BLANK]
  }

  const nameWidth = 20
  const valueWidth = 11
  const usersWidth = 11
  const barWidth = Math.max(8, inner - 2 - nameWidth - valueWidth - usersWidth - 3)
  const max = Math.max(...report.channels.map((channel) => channel.sessions), 0)

  const header =
    ' ' +
    [
      cell('CHANNEL', nameWidth),
      cell('', barWidth),
      cell('SESSIONS', valueWidth, { align: 'right' }),
      cell('USERS', usersWidth, { align: 'right' }),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = report.channels.map((channel) =>
    [
      '',
      cell(channel.channel, nameWidth, { paint: color.text }),
      hbar(channel.sessions, max, barWidth, color.blue),
      cell(count(channel.sessions), valueWidth, { align: 'right', paint: color.text }),
      cell(count(channel.activeUsers), usersWidth, { align: 'right', paint: color.muted }),
    ].join(' '),
  )

  return [BLANK, header, ...rows, BLANK]
}

export function topPagesBody(report: GaPropertyReport, width: number): string[] {
  const inner = width - 2
  if (report.topPages.length === 0) {
    return [BLANK, ` ${dim(color.faint('No page data.'))}`, BLANK]
  }

  const viewsWidth = 11
  const usersWidth = 11
  const barWidth = 14
  const pathWidth = Math.max(16, inner - 2 - viewsWidth - usersWidth - barWidth - 3)
  const max = Math.max(...report.topPages.map((page) => page.pageViews), 0)

  const header =
    ' ' +
    [
      cell('PAGE', pathWidth),
      cell('', barWidth),
      cell('VIEWS', viewsWidth, { align: 'right' }),
      cell('USERS', usersWidth, { align: 'right' }),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = report.topPages.map((page) =>
    [
      '',
      cell(page.path, pathWidth, { paint: color.text }),
      hbar(page.pageViews, max, barWidth, color.purple),
      cell(count(page.pageViews), viewsWidth, { align: 'right', paint: color.text }),
      cell(count(page.activeUsers), usersWidth, { align: 'right', paint: color.muted }),
    ].join(' '),
  )

  return [BLANK, header, ...rows, BLANK]
}

/** Totals across every property, shown when none is selected. */
export function analyticsSummaryLine(snapshot: AnalyticsSnapshot | null): string {
  if (!snapshot || !snapshot.configured) return ''
  const totals = snapshot.overview.reduce(
    (accumulator, summary) => ({
      users: accumulator.users + summary.totals.activeUsers,
      sessions: accumulator.sessions + summary.totals.sessions,
      views: accumulator.views + summary.totals.pageViews,
    }),
    { users: 0, sessions: 0, views: 0 },
  )

  const parts = [
    `${color.green('live')} ${bold(snapshot.liveUsers == null ? '—' : count(snapshot.liveUsers))}`,
    `${color.blue('users')} ${bold(count(totals.users))}`,
    `${color.purple('views')} ${bold(count(totals.views))}`,
    `${color.muted('range')} ${bold(snapshot.range)}`,
    `${color.muted(`${snapshot.properties.length} ${snapshot.properties.length === 1 ? 'property' : 'properties'}`)}`,
  ]
  return ' ' + parts.join(dim(color.faint('  │  ')))
}
