/** The live admin TUI: polling, layout, scrolling and key handling. */

import { queryClient } from '@nwai/db'
import { fetchDbSnapshot, resolveAdminUserId, type DbSnapshot } from './db-stats.ts'
import {
  AnalyticsStore,
  nextRange,
  type AnalyticsSnapshot,
  type GaDateRange,
} from './analytics.ts'
import {
  analyticsSetupBody,
  analyticsSummaryLine,
  channelsBody,
  propertiesBody,
  realtimeBody,
  reportTotalsBody,
  reportTrendBody,
  topPagesBody,
} from './analytics-panels.ts'
import { FULL_REBUILD_MS, SalesStore, type SalesSnapshot } from './sales.ts'
import {
  activityBody,
  favoritesBody,
  freshness,
  invoicesBody,
  pendingBanner,
  platformBody,
  queueBody,
  salesBody,
  errorNote,
  signupsBody,
  summaryLine,
  transactionsBody,
} from './panels.ts'
import {
  bold,
  color,
  dim,
  padEnd,
  panel,
  inverse,
  spinner,
  term,
  truncateAnsiSafe,
  visibleWidth,
} from './ui.ts'
import { formatCents, formatClock } from './format.ts'

export type TabId = 'overview' | 'analytics'

export interface AppOptions {
  adminEmail: string | null
  dbIntervalMs: number
  salesIntervalMs: number
  gaIntervalMs: number
  queueLimit: number
  signupLimit: number
  maxWidth: number
  once: boolean
  tab: TabId
}

type SectionId =
  | 'sales'
  | 'transactions'
  | 'activity'
  | 'invoices'
  | 'platform'
  | 'signups'
  | 'queue'
  | 'favorites'
  | 'realtime'
  | 'properties'
  | 'totals'
  | 'trend'
  | 'channels'
  | 'pages'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'analytics', label: 'Analytics' },
]

/** Section jump keys, per tab. */
const JUMPS: Record<TabId, Record<string, SectionId>> = {
  overview: {
    s: 'sales',
    t: 'transactions',
    a: 'activity',
    i: 'invoices',
    p: 'platform',
    u: 'signups',
    e: 'queue',
    f: 'favorites',
  },
  analytics: {
    l: 'realtime',
    o: 'properties',
    t: 'totals',
    c: 'channels',
    p: 'pages',
  },
}

interface State {
  tab: TabId
  db: DbSnapshot | null
  dbError: string | null
  dbLoading: boolean
  sales: SalesSnapshot | null
  salesError: string | null
  salesLoading: boolean
  analytics: AnalyticsSnapshot | null
  analyticsError: string | null
  analyticsLoading: boolean
  gaRange: GaDateRange
  gaPropertyIndex: number | null
  chartRange: 30 | 90
  scroll: Record<TabId, number>
  tick: number
  showHelp: boolean
  adminUserId: number | null
  status: string
}

const CTRL_C = '\x03'
const CTRL_D = '\x04'
const ESC = '\x1B'
const TAB = '\t'

const KEYS: Array<[string, string]> = [
  ['q / Ctrl-C', 'quit'],
  ['Tab', 'next tab, Shift-Tab for previous'],
  ['1 / 2', 'Overview / Analytics'],
  ['r', 'refresh the active tab now'],
  ['R', 'rebuild Stripe history and rediscover GA properties'],
  ['j / k', 'scroll one line'],
  ['Up / Down', 'scroll one line'],
  ['PgUp / PgDn', 'scroll one screen'],
  ['g / G', 'jump to top / bottom'],
  ['d', 'cycle the date range of the active tab'],
  ['', ''],
  ['Overview', ''],
  ['3 / 9', 'chart range: 30 or 90 days'],
  ['s t a i', "Sales, Today's payments, Activity, Invoices"],
  ['p', 'Platform stats'],
  ['u e f', 'Recent signups, Review queue, Favorites'],
  ['', ''],
  ['Analytics', ''],
  ['n / N', 'focus the next / previous property'],
  ['0', 'back to all properties'],
  ['l o t c p', 'Live, Properties, Totals, Channels, Pages'],
  ['', ''],
  ['?', 'toggle this help'],
]

export async function run(options: AppOptions): Promise<void> {
  const stripeKey = process.env.STRIPE_SECRET || ''
  const salesStore = stripeKey ? new SalesStore(stripeKey) : null

  const analyticsStore = new AnalyticsStore()

  const state: State = {
    tab: options.tab,
    db: null,
    dbError: null,
    dbLoading: true,
    sales: null,
    salesError: stripeKey ? null : 'STRIPE_SECRET is not set, so sales data is unavailable.',
    salesLoading: Boolean(stripeKey),
    analytics: null,
    analyticsError: null,
    analyticsLoading: false,
    gaRange: '28d',
    gaPropertyIndex: null,
    chartRange: 30,
    scroll: { overview: 0, analytics: 0 },
    tick: 0,
    showHelp: false,
    adminUserId: null,
    status: '',
  }

  if (options.adminEmail) {
    try {
      state.adminUserId = await resolveAdminUserId(options.adminEmail)
      if (state.adminUserId === null) {
        state.status = `No user matches ${options.adminEmail}, so favorites are hidden.`
      }
    } catch {
      // The first database poll reports connection problems.
    }
  }

  const anchors = new Map<SectionId, number>()
  let bodyLines: string[] = []
  let bodyHeight = 10
  let stopped = false
  let dbTimer: ReturnType<typeof setInterval> | undefined
  let salesTimer: ReturnType<typeof setInterval> | undefined
  let gaTimer: ReturnType<typeof setInterval> | undefined
  let tickTimer: ReturnType<typeof setInterval> | undefined

  /**
   * Drizzle wraps a driver failure in "Failed query: …", which says nothing
   * about the cause. Unwrap it so the panel shows the connection error itself.
   */
  const describeError = (error: unknown): string => {
    if (!(error instanceof Error)) return String(error)
    const parts = [error.message]
    let cause: unknown = error.cause
    for (let depth = 0; cause instanceof Error && depth < 3; depth++) {
      if (!parts.includes(cause.message)) parts.push(cause.message)
      cause = cause.cause
    }
    return parts.join(' · ')
  }

  const refreshDb = async (): Promise<void> => {
    if (state.dbLoading && state.db) return
    state.dbLoading = true
    render()
    try {
      state.db = await fetchDbSnapshot({
        adminUserId: state.adminUserId,
        queueLimit: options.queueLimit,
        signupLimit: options.signupLimit,
      })
      state.dbError = null
    } catch (error) {
      state.dbError = describeError(error)
    } finally {
      state.dbLoading = false
      render()
    }
  }

  const refreshSales = async (full = false): Promise<void> => {
    if (!salesStore) return
    if (state.salesLoading && state.sales) return
    state.salesLoading = true
    render()
    try {
      state.sales = await salesStore.refresh({ full })
      state.salesError = null
      if (full) state.status = ''
    } catch (error) {
      state.salesError = describeError(error)
    } finally {
      state.salesLoading = false
      render()
    }
  }

  const selectedPropertyId = (): string | null => {
    const properties = state.analytics?.properties ?? []
    if (state.gaPropertyIndex == null) return null
    return properties[state.gaPropertyIndex]?.propertyId ?? null
  }

  const refreshAnalytics = async (full = false): Promise<void> => {
    if (state.analyticsLoading && state.analytics) return
    state.analyticsLoading = true
    render()
    try {
      state.analytics = await analyticsStore.refresh({
        range: state.gaRange,
        selectedPropertyId: selectedPropertyId(),
        full,
      })
      state.analyticsError = null
    } catch (error) {
      state.analyticsError = describeError(error)
    } finally {
      state.analyticsLoading = false
      render()
    }
  }

  function buildOverviewBody(width: number): string[] {
    const spin = spinner(state.tick)
    const lines: string[] = []
    anchors.clear()

    const push = (id: SectionId, block: string[]) => {
      anchors.set(id, lines.length)
      lines.push(...block, '')
    }

    const banner = pendingBanner(state.db?.stats ?? null, width)
    if (banner.length > 0) lines.push(...banner, '')

    push(
      'sales',
      panel({
        title: 'Sales',
        width,
        accent: color.green,
        note: state.salesError
          ? 'unavailable'
          : freshness(state.sales?.fetchedAt ?? null, state.salesLoading, spin),
        body: salesBody(state.sales, state.salesError, width),
      }),
    )

    push(
      'transactions',
      panel({
        title: `Today's payments (${state.sales?.todayTransactions.length ?? 0})`,
        width,
        accent: color.green,
        note: state.salesError
          ? 'error · retrying'
          : 'newest first · click to open in Stripe',
        body: transactionsBody(
          state.sales?.todayTransactions ?? [],
          state.salesError,
          width,
        ),
      }),
    )

    if (state.sales) {
      const chartHeight = Math.max(5, Math.min(12, Math.floor(bodyHeight / 3)))
      push(
        'activity',
        panel({
          title: 'Activity over time',
          width,
          accent: color.blue,
          note: `${state.chartRange}d window`,
          body: activityBody(state.sales, state.chartRange, width, chartHeight),
        }),
      )

      const outstanding = state.sales.invoices.reduce(
        (sum, invoice) => sum + invoice.amountRemaining,
        0,
      )
      push(
        'invoices',
        panel({
          title: `Outstanding invoices (${state.sales.invoices.length})`,
          width,
          accent: color.amber,
          note: `${formatCents(outstanding)} · last 30 days`,
          body: invoicesBody(state.sales.invoices, width),
        }),
      )
    }

    push(
      'platform',
      panel({
        title: 'Platform stats',
        width,
        accent: color.purple,
        // A poll that fails leaves the previous numbers on screen with the
        // reason above them; the next poll clears it.
        note: state.dbError
          ? 'error · retrying'
          : freshness(state.db?.fetchedAt ?? null, state.dbLoading, spin),
        body: state.db
          ? [
              ...(state.dbError ? [...errorNote(state.dbError, width), ''] : []),
              ...platformBody(state.db.stats, width),
            ]
          : ['', ` ${color.red(state.dbError ?? 'Loading platform stats…')}`, ''],
      }),
    )

    push(
      'signups',
      panel({
        title: 'Recent signups',
        width,
        accent: color.cyan,
        note: state.db ? `newest ${state.db.signups.length}` : '',
        body: signupsBody(state.db?.signups ?? [], width),
      }),
    )

    push(
      'queue',
      panel({
        title: `Editorial review queue (${state.db?.stats.pendingReleases ?? 0})`,
        width,
        accent: color.violet,
        note: state.db ? `showing ${state.db.queue.length}` : '',
        body: queueBody(state.db?.queue ?? [], width),
      }),
    )

    if (state.db && state.db.favorites.length > 0) {
      push(
        'favorites',
        panel({
          title: `Favorite users (${state.db.favorites.length})`,
          width,
          accent: color.yellow,
          body: favoritesBody(state.db.favorites, width),
        }),
      )
    }

    return lines
  }

  function buildAnalyticsBody(width: number): string[] {
    const spin = spinner(state.tick)
    const lines: string[] = []
    anchors.clear()

    const push = (id: SectionId, block: string[]) => {
      anchors.set(id, lines.length)
      lines.push(...block, '')
    }

    const note = state.analyticsError
      ? 'error'
      : freshness(state.analytics?.fetchedAt ?? null, state.analyticsLoading, spin)

    const setup = analyticsSetupBody(state.analytics, state.analyticsError, width)
    if (setup) {
      push(
        'realtime',
        panel({ title: 'Google Analytics', width, accent: color.amber, note, body: setup }),
      )
      return lines
    }

    const snapshot = state.analytics!

    push(
      'realtime',
      panel({
        title: 'Right now',
        width,
        accent: color.green,
        note,
        body: realtimeBody(snapshot, width),
      }),
    )

    push(
      'properties',
      panel({
        title: `Properties (${snapshot.properties.length})`,
        width,
        accent: color.blue,
        note: `${snapshot.range} · press d to change`,
        body: propertiesBody(snapshot, width),
      }),
    )

    const report = snapshot.report
    if (!report) {
      lines.push(
        ` ${dim(color.faint('Focus a property with n to see its trend, channels and top pages.'))}`,
        '',
      )
      return lines
    }

    push(
      'totals',
      panel({
        title: `${report.label} · totals`,
        width,
        accent: color.purple,
        note: snapshot.range,
        body: reportTotalsBody(report, width),
      }),
    )

    const chartHeight = Math.max(5, Math.min(12, Math.floor(bodyHeight / 3)))
    push(
      'trend',
      panel({
        title: 'Users and page views',
        width,
        accent: color.blue,
        note: `${report.timeseries.length} days`,
        body: reportTrendBody(report, width, chartHeight),
      }),
    )

    push(
      'channels',
      panel({
        title: 'Channels',
        width,
        accent: color.cyan,
        note: 'sessions by default channel group',
        body: channelsBody(report, width),
      }),
    )

    push(
      'pages',
      panel({
        title: 'Top pages',
        width,
        accent: color.violet,
        note: 'highest page views in this range',
        body: topPagesBody(report, width),
      }),
    )

    return lines
  }

  function buildBody(width: number): string[] {
    return state.tab === 'analytics' ? buildAnalyticsBody(width) : buildOverviewBody(width)
  }

  function buildHelp(width: number): string[] {
    const dbSeconds = Math.round(options.dbIntervalMs / 1000)
    const salesSeconds = Math.round(options.salesIntervalMs / 1000)
    const rebuildMinutes = Math.round(FULL_REBUILD_MS / 60000)

    return panel({
      title: 'Keys',
      width,
      accent: color.cyan,
      body: [
        '',
        ...KEYS.map(
          ([key, description]) =>
            ` ${bold(color.cyan(padEnd(key, 14)))} ${color.muted(description)}`,
        ),
        '',
        ` ${dim(color.faint(`The database is polled every ${dbSeconds}s and Stripe every ${salesSeconds}s.`))}`,
        ` ${dim(color.faint(`Stripe history is rebuilt from scratch every ${rebuildMinutes} minutes, and whenever you press R.`))}`,
        '',
      ],
    })
  }

  function render(): void {
    // --once builds its frame at the end; nothing paints while it loads.
    if (stopped || options.once) return
    const rows = process.stdout.rows || 40
    const columnCount = Math.min(process.stdout.columns || 100, options.maxWidth)
    const width = Math.max(60, columnCount)

    bodyHeight = Math.max(3, rows - 4)
    bodyLines = state.showHelp ? buildHelp(width) : buildBody(width)

    const maxScroll = Math.max(0, bodyLines.length - bodyHeight)
    const scroll = Math.min(Math.max(state.scroll[state.tab], 0), maxScroll)
    state.scroll[state.tab] = scroll

    const visible = bodyLines.slice(scroll, scroll + bodyHeight)
    while (visible.length < bodyHeight) visible.push('')

    const busy =
      state.tab === 'analytics'
        ? state.analyticsLoading
        : state.dbLoading || state.salesLoading
    const live = busy
      ? color.amber(`${spinner(state.tick)} syncing`)
      : color.green('● live')

    const tabs = TABS.map((tab, index) => {
      const label = ` ${index + 1} ${tab.label} `
      return tab.id === state.tab ? inverse(bold(color.text(label))) : dim(color.faint(label))
    }).join(dim(color.faint('')))

    const clock = dim(color.faint(formatClock(Date.now())))
    const headerLeft = ` ${bold(color.text('Newsworthy Admin'))}  ${tabs}  ${live}`
    const header = padEnd(headerLeft, width - visibleWidth(clock) - 1) + clock

    const scrollHint =
      maxScroll > 0 ? dim(color.faint(`${Math.round((scroll / maxScroll) * 100)}%`)) : ''
    const keyHint = dim(
      color.faint(
        state.tab === 'analytics'
          ? 'q quit · Tab tabs · n property · d range · r refresh · ? help'
          : 'q quit · Tab tabs · r refresh · R rebuild · j/k scroll · ? help',
      ),
    )
    const status = state.status ? color.amber(` ${state.status}`) : ''
    const footerLeft = ` ${keyHint}${status}`
    const footer = padEnd(footerLeft, width - visibleWidth(scrollHint) - 1) + scrollHint

    const frame = [
      header,
      state.tab === 'analytics'
        ? analyticsSummaryLine(state.analytics)
        : summaryLine(state.db, state.sales),
      ...visible,
      color.faint('─'.repeat(width)),
      footer,
    ].map((line) => truncateAnsiSafe(line, width) + term.clearLine)

    process.stdout.write(term.home + frame.join('\n') + term.clearBelow)
  }

  function scrollBy(amount: number): void {
    state.scroll[state.tab] += amount
    render()
  }

  function jump(section: SectionId): void {
    const index = anchors.get(section)
    if (index == null) {
      state.status = `The ${section} panel has not loaded yet.`
      render()
      return
    }
    state.status = ''
    state.scroll[state.tab] = index
    render()
  }

  function selectTab(tab: TabId): void {
    state.tab = tab
    state.status = ''
    state.showHelp = false
    // The analytics tab only polls while it is on screen, so its first view
    // has to kick off the fetch itself.
    if (tab === 'analytics' && !state.analytics && !state.analyticsLoading) {
      void refreshAnalytics()
    }
    render()
  }

  function stepProperty(direction: 1 | -1): void {
    const total = state.analytics?.properties.length ?? 0
    if (total === 0) return
    const current = state.gaPropertyIndex
    const next =
      current == null
        ? direction === 1
          ? 0
          : total - 1
        : (current + direction + total) % total
    state.gaPropertyIndex = next
    state.scroll.analytics = 0
    void refreshAnalytics()
  }

  function handleKey(chunk: Buffer): void {
    const key = chunk.toString('utf8')

    if (key === 'q' || key === CTRL_C || key === CTRL_D) {
      void shutdown(0)
      return
    }
    if (key === TAB) {
      const index = TABS.findIndex((tab) => tab.id === state.tab)
      selectTab(TABS[(index + 1) % TABS.length].id)
      return
    }
    if (key === ESC + '[Z') {
      const index = TABS.findIndex((tab) => tab.id === state.tab)
      selectTab(TABS[(index - 1 + TABS.length) % TABS.length].id)
      return
    }
    if (key === '1' || key === '2') {
      selectTab(key === '1' ? 'overview' : 'analytics')
      return
    }
    if (key === 'r') {
      state.status = ''
      if (state.tab === 'analytics') {
        void refreshAnalytics()
      } else {
        void refreshDb()
        void refreshSales(false)
      }
      return
    }
    if (key === 'R') {
      if (state.tab === 'analytics') {
        state.status = 'Rediscovering GA properties.'
        void refreshAnalytics(true)
      } else {
        state.status = 'Rebuilding the full Stripe history.'
        void refreshSales(true)
      }
      return
    }
    if (key === 'd') {
      if (state.tab === 'analytics') {
        state.gaRange = nextRange(state.gaRange)
        void refreshAnalytics()
      } else {
        state.chartRange = state.chartRange === 30 ? 90 : 30
        render()
      }
      return
    }
    if (state.tab === 'analytics') {
      if (key === 'n') {
        stepProperty(1)
        return
      }
      if (key === 'N') {
        stepProperty(-1)
        return
      }
      if (key === '0') {
        state.gaPropertyIndex = null
        state.scroll.analytics = 0
        void refreshAnalytics()
        return
      }
    }
    if (state.tab === 'overview' && (key === '3' || key === '9')) {
      state.chartRange = key === '3' ? 30 : 90
      render()
      return
    }
    if (key === '?') {
      state.showHelp = !state.showHelp
      state.scroll[state.tab] = 0
      render()
      return
    }
    if (key === 'j' || key === ESC + '[B') {
      scrollBy(1)
      return
    }
    if (key === 'k' || key === ESC + '[A') {
      scrollBy(-1)
      return
    }
    if (key === ' ' || key === ESC + '[6~') {
      scrollBy(bodyHeight - 2)
      return
    }
    if (key === ESC + '[5~') {
      scrollBy(-(bodyHeight - 2))
      return
    }
    if (key === 'g' || key === ESC + '[H') {
      state.scroll[state.tab] = 0
      render()
      return
    }
    if (key === 'G' || key === ESC + '[F') {
      state.scroll[state.tab] = Number.MAX_SAFE_INTEGER
      render()
      return
    }

    const target = JUMPS[state.tab][key]
    if (target) jump(target)
  }

  async function shutdown(code: number): Promise<void> {
    if (stopped) return
    stopped = true
    if (dbTimer) clearInterval(dbTimer)
    if (salesTimer) clearInterval(salesTimer)
    if (gaTimer) clearInterval(gaTimer)
    if (tickTimer) clearInterval(tickTimer)
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(term.showCursor + term.leaveAlt)
    try {
      await queryClient.end({ timeout: 2 })
    } catch {
      // The connection goes away with the process regardless.
    }
    process.exit(code)
  }

  // --once writes a single frame to normal scrollback and exits, which suits
  // status bars, cron jobs and `watch`.
  if (options.once) {
    await Promise.all([
      refreshDb(),
      refreshSales(true),
      // Analytics costs GA API calls, so a single frame only pays for them
      // when that tab is the one being printed.
      state.tab === 'analytics' ? refreshAnalytics(true) : Promise.resolve(),
    ])
    const width = Math.max(60, Math.min(process.stdout.columns || 100, options.maxWidth))
    bodyHeight = 30
    const lines = [
      ` ${bold(color.text('Newsworthy Admin'))} ${dim(color.faint(formatClock(Date.now())))}`,
      summaryLine(state.db, state.sales),
      ...buildBody(width),
    ]
    process.stdout.write(`${lines.join('\n')}\n`)
    await queryClient.end({ timeout: 2 })
    return
  }

  process.stdout.write(term.enterAlt + term.hideCursor + term.clear)
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.on('data', handleKey)
  process.stdout.on('resize', render)
  process.on('SIGINT', () => void shutdown(0))
  process.on('SIGTERM', () => void shutdown(0))

  dbTimer = setInterval(() => void refreshDb(), options.dbIntervalMs)
  salesTimer = setInterval(() => void refreshSales(false), options.salesIntervalMs)
  // GA quota is per-property and per-day, so this polls only while the tab it
  // feeds is actually on screen.
  gaTimer = setInterval(() => {
    if (state.tab === 'analytics') void refreshAnalytics()
  }, options.gaIntervalMs)
  tickTimer = setInterval(() => {
    state.tick += 1
    render()
  }, 1000)

  render()
  await Promise.all([
    refreshDb(),
    refreshSales(false),
    state.tab === 'analytics' ? refreshAnalytics() : Promise.resolve(),
  ])
}
