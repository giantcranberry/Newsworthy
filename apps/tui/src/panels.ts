/** Panel renderers. Each returns the body lines for one card on the page. */

import {
  bold,
  cell,
  color,
  axisLabels,
  columns,
  dim,
  distributeWidths,
  link,
  padStart,
  sparkline,
  splitWidth,
  stackedBarChart,
  truncate,
  type Paint,
} from './ui.ts'
import {
  delta,
  formatAge,
  formatCents,
  formatCompactCents,
  formatCountdown,
  formatEpochDate,
  formatEpochTime,
  formatRelativeDay,
  plural,
} from './format.ts'
import type {
  DailySalesPoint,
  OpenInvoice,
  SalesPeriod,
  SalesSnapshot,
  Transaction,
} from './sales.ts'
import type {
  DbSnapshot,
  FavoriteUser,
  PlatformStats,
  QueueItem,
  RecentSignup,
} from './db-stats.ts'

const BLANK = ''

/** Wide enough for a whole `dashboard.stripe.com/payments/ch_…` link. */
const STRIPE_URL_WIDTH = 66

/**
 * A failed refresh shown above data that is still on screen. Stale numbers are
 * more useful than an empty panel, so the error explains itself and the last
 * good values stay put.
 */
export function errorNote(error: string, width: number): string[] {
  return [` ${color.red(truncate(`last refresh failed · ${error}`, width - 3))}`]
}

function deltaText(current: number, previous: number): string {
  const change = delta(current, previous)
  if (change.direction === 'up') return color.green(`▲ ${change.text}`)
  if (change.direction === 'down') return color.red(`▼ ${change.text}`)
  return dim(color.muted(`  ${change.text}`))
}

/** One period tile: current amount on top, previous period underneath. */
function periodCard(options: {
  label: string
  paint: Paint
  current: SalesPeriod
  previous: SalesPeriod
  previousLabel: string
  width: number
  showOutOfBand: boolean
}): string[] {
  const { label, paint, current, previous, previousLabel, width, showOutOfBand } = options
  const inner = width - 1

  // Out-of-band money is already inside `amount`; this line only says how much
  // of the total arrived that way. The row is kept, blank, on the other cards
  // so every column in the panel stays the same height.
  const outOfBand =
    current.oobAmount > 0
      ? ` ${color.green(truncate(`${formatCents(current.oobAmount)} out of band`, inner))}`
      : ' '

  return [
    ` ${paint('●')} ${dim(color.muted(label.toUpperCase()))}`,
    ` ${bold(paint(truncate(formatCents(current.amount), inner)))}`,
    ` ${dim(color.faint(truncate(plural(current.count, 'transaction'), inner)))}`,
    ...(showOutOfBand ? [outOfBand] : []),
    ` ${color.faint('─'.repeat(Math.max(0, inner)))}`,
    ` ${dim(color.faint(previousLabel))} ${deltaText(current.amount, previous.amount)}`,
    ` ${color.muted(truncate(formatCents(previous.amount), inner))}`,
    ` ${dim(color.faint(truncate(plural(previous.count, 'transaction'), inner)))}`,
  ]
}

export function salesBody(sales: SalesSnapshot | null, error: string | null, width: number): string[] {
  const inner = width - 2
  if (!sales) {
    if (error) return [BLANK, ` ${color.red(truncate(error, inner - 1))}`, BLANK]
    return [BLANK, ` ${color.muted('Loading sales data from Stripe…')}`, BLANK]
  }

  const widths = splitWidth(inner - 1, 4, 2)
  const showOutOfBand = [sales.today, sales.wtd, sales.mtd, sales.ytd].some(
    (period) => period.oobAmount > 0,
  )
  const cards = [
    periodCard({
      label: 'Today',
      paint: color.green,
      current: sales.today,
      previous: sales.prevToday,
      previousLabel: 'Yesterday',
      width: widths[0],
      showOutOfBand,
    }),
    periodCard({
      label: 'Week to date',
      paint: color.blue,
      current: sales.wtd,
      previous: sales.prevWtd,
      previousLabel: 'Last week',
      width: widths[1],
      showOutOfBand,
    }),
    periodCard({
      label: 'Month to date',
      paint: color.purple,
      current: sales.mtd,
      previous: sales.prevMtd,
      previousLabel: 'Last month',
      width: widths[2],
      showOutOfBand,
    }),
    periodCard({
      label: 'Year to date',
      paint: color.amber,
      current: sales.ytd,
      previous: sales.prevYtd,
      previousLabel: 'Last year',
      width: widths[3],
      showOutOfBand,
    }),
  ]

  return [
    BLANK,
    ...(error ? [...errorNote(error, width), BLANK] : []),
    ...columns(cards, widths, 2),
    BLANK,
  ]
}

/** Revenue bars with a transaction-count sparkline underneath. */
export function activityBody(
  sales: SalesSnapshot | null,
  range: 30 | 90,
  width: number,
  height: number,
): string[] {
  const inner = width - 2
  if (!sales) return [BLANK, ` ${color.muted('Waiting for Stripe…')}`, BLANK]

  const gutter = 9
  const plotWidth = Math.max(10, inner - gutter - 4)

  // Widen each day's bar so a 30-day window still fills a wide terminal, and
  // fall back to the most recent days when the panel is narrower than the range.
  const windowed = sales.series.slice(-range)
  const points: DailySalesPoint[] =
    windowed.length <= plotWidth ? windowed : windowed.slice(-plotWidth)
  const barWidths = distributeWidths(plotWidth, points.length)
  const span = plotWidth

  const totalAmount = points.reduce((sum, point) => sum + point.amount, 0)
  const totalCount = points.reduce((sum, point) => sum + point.count, 0)
  const totalOob = points.reduce((sum, point) => sum + point.oobAmount, 0)
  const maxAmount = Math.max(...points.map((point) => point.amount), 0)

  const bars = stackedBarChart(
    points.map((point) => point.amount - point.oobAmount),
    points.map((point) => point.oobAmount),
    height,
    color.blue,
    color.green,
    barWidths,
  )

  const gutterLabel = (text: string) => padStart(dim(color.faint(text)), gutter)
  const rows = bars.map((row, index) => {
    let axis = gutterLabel('')
    if (index === 0) axis = gutterLabel(formatCompactCents(maxAmount))
    else if (index === Math.floor(height / 2)) {
      axis = gutterLabel(formatCompactCents(maxAmount / 2))
    }
    return ` ${axis} ${color.faint('\u2502')}${row}`
  })

  const labels = axisLabels(
    points[0]?.label ?? '',
    points[Math.floor(points.length / 2)]?.label ?? '',
    points[points.length - 1]?.label ?? '',
    span,
  )

  // The legend only earns its line when there is out-of-band money to explain.
  const legend =
    totalOob > 0
      ? ` ${' '.repeat(gutter)} ${color.blue('\u2588')} ${dim(color.faint('card'))} ${color.muted(formatCents(totalAmount - totalOob))}   ${color.green('\u2588')} ${dim(color.faint('out of band'))} ${color.muted(formatCents(totalOob))}`
      : null

  return [
    BLANK,
    ` ${color.muted(`${points.length}-day window`)}  ${bold(color.text(formatCents(totalAmount)))} ${dim(color.faint('\u00b7'))} ${color.text(plural(totalCount, 'transaction'))}`,
    ...(legend ? [legend] : []),
    BLANK,
    ...rows,
    ` ${gutterLabel('$0')} ${color.faint('\u2514' + '\u2500'.repeat(span))}`,
    ' '.repeat(gutter + 3) + dim(color.faint(labels)),
    BLANK,
    ` ${gutterLabel('txns')} ${color.faint('\u2502')}${sparkline(points.map((point) => point.count), color.amber, barWidths)}`,
    BLANK,
  ]
}

/**
 * Every payment taken today, newest first. The reference cell is an OSC 8
 * hyperlink to the payment or invoice in the Stripe dashboard, and the raw URL
 * is printed as well whenever the panel is wide enough to hold it, for
 * terminals that do not make links clickable.
 */
export function transactionsBody(
  transactions: Transaction[],
  error: string | null,
  width: number,
): string[] {
  const inner = width - 2
  if (transactions.length === 0) {
    if (error) return [BLANK, ` ${color.red(truncate(error, inner - 1))}`, BLANK]
    return [BLANK, ` ${color.muted('No payments taken yet today.')}`, BLANK]
  }

  const timeWidth = 9
  const amountWidth = 12
  const kindWidth = 12
  const customerWidth = 28
  const gaps = 5
  const fixed = timeWidth + amountWidth + kindWidth + customerWidth + gaps
  // A truncated URL cannot be copied, so the column appears at its full width
  // or not at all. Elsewhere the customer cell carries the link on its own.
  const urlWidth = inner - 1 - fixed - 24 >= STRIPE_URL_WIDTH ? STRIPE_URL_WIDTH : 0
  const detailWidth = Math.max(16, inner - 1 - fixed - urlWidth)

  const header =
    ' ' +
    [
      cell('TIME', timeWidth),
      cell('AMOUNT', amountWidth, { align: 'right' }),
      cell('METHOD', kindWidth),
      cell('CUSTOMER', customerWidth),
      cell('DETAIL', detailWidth),
      ...(urlWidth ? [cell('STRIPE', urlWidth)] : []),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = transactions.map((transaction) => {
    const paint = transaction.kind === 'oob' ? color.green : color.blue
    const method = transaction.kind === 'oob' ? 'out of band' : 'card'

    return (
      ' ' +
      [
        cell(formatEpochTime(transaction.at), timeWidth, { paint: color.muted }),
        cell(formatCents(transaction.amount), amountWidth, {
          align: 'right',
          paint: bold,
        }),
        cell(method, kindWidth, { paint }),
        link(
          cell(transaction.label ?? '—', customerWidth, {
            paint: transaction.label ? color.text : color.faint,
          }),
          transaction.url,
        ),
        cell(transaction.reference ?? '—', detailWidth, { paint: color.muted }),
        ...(urlWidth
          ? [link(cell(transaction.url, urlWidth, { paint: color.cyan }), transaction.url)]
          : []),
      ].join(' ')
    )
  })

  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0)
  const footer = ` ${dim(color.faint('total'))} ${bold(color.text(formatCents(total)))} ${dim(color.faint('·'))} ${dim(color.faint(plural(transactions.length, 'payment')))}`

  return [
    BLANK,
    ...(error ? [...errorNote(error, width), BLANK] : []),
    header,
    ...rows,
    BLANK,
    footer,
    BLANK,
  ]
}

export function invoicesBody(invoices: OpenInvoice[], width: number): string[] {
  const inner = width - 2
  if (invoices.length === 0) {
    return [BLANK, ` ${color.green('No open invoices in the last 30 days.')}`, BLANK]
  }

  const numberWidth = 14
  const dueWidth = 12
  const remainingWidth = 12
  const createdWidth = 13
  const dueDateWidth = 13
  const gaps = 5
  const customerWidth = Math.max(
    12,
    inner - 1 - numberWidth - dueWidth - remainingWidth - createdWidth - dueDateWidth - gaps,
  )

  const header =
    ' ' +
    [
      cell('INVOICE', numberWidth),
      cell('CUSTOMER', customerWidth),
      cell('AMOUNT DUE', dueWidth, { align: 'right' }),
      cell('REMAINING', remainingWidth, { align: 'right' }),
      cell('CREATED', createdWidth),
      cell('DUE', dueDateWidth),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = invoices.map((invoice) => {
    const customer =
      invoice.customerName || invoice.customerEmail || 'Unknown'
    const secondary = invoice.customerName && invoice.customerEmail ? invoice.customerEmail : ''
    const remainingPaint = invoice.amountRemaining > 0 ? color.amber : color.muted

    const line =
      ' ' +
      [
        cell(invoice.number || invoice.id.slice(-8), numberWidth, { paint: color.cyan }),
        cell(customer, customerWidth, { paint: color.text }),
        cell(formatCents(invoice.amountDue), dueWidth, { align: 'right', paint: color.text }),
        cell(formatCents(invoice.amountRemaining), remainingWidth, {
          align: 'right',
          paint: remainingPaint,
        }),
        cell(formatEpochDate(invoice.created), createdWidth, { paint: color.muted }),
        cell(
          invoice.dueDate ? formatEpochDate(invoice.dueDate) : '—',
          dueDateWidth,
          { paint: color.muted },
        ),
      ].join(' ')

    if (!secondary) return [line]
    return [
      line,
      ' ' + ' '.repeat(numberWidth + 1) + dim(color.faint(truncate(secondary, customerWidth))),
    ]
  })

  return [BLANK, header, ...rows.flat(), BLANK]
}

function statTile(options: {
  label: string
  value: number
  paint: Paint
  width: number
}): string[] {
  const { label, value, paint, width } = options
  return [
    ` ${paint('▐')} ${dim(color.faint(label.toUpperCase()))}`,
    ` ${paint('▐')} ${bold(paint(truncate(value.toLocaleString('en-US'), width - 4)))}`,
  ]
}

export function platformBody(stats: PlatformStats | null, width: number): string[] {
  const inner = width - 2
  if (!stats) return [BLANK, ` ${color.muted('Loading platform stats…')}`, BLANK]

  const widths = splitWidth(inner - 1, 5, 2)
  const tiles = [
    statTile({ label: 'Users', value: stats.users, paint: color.blue, width: widths[0] }),
    statTile({ label: 'Releases', value: stats.releases, paint: color.green, width: widths[1] }),
    statTile({ label: 'Companies', value: stats.companies, paint: color.purple, width: widths[2] }),
    statTile({ label: 'Partners', value: stats.partners, paint: color.amber, width: widths[3] }),
    statTile({
      label: 'Approvals',
      value: stats.pendingApprovals,
      paint: stats.pendingApprovals > 0 ? color.cyan : color.muted,
      width: widths[4],
    }),
  ]

  return [BLANK, ...columns(tiles, widths, 2), BLANK]
}

export function queueBody(items: QueueItem[], width: number): string[] {
  const inner = width - 2
  if (items.length === 0) {
    return [BLANK, ` ${color.green('All caught up. No press releases pending review.')}`, BLANK]
  }

  const companyWidth = 22
  const ownerWidth = 26
  const scheduledWidth = 20
  const gaps = 3
  const titleWidth = Math.max(16, inner - 1 - companyWidth - ownerWidth - scheduledWidth - gaps)

  const header =
    ' ' +
    [
      cell('RELEASE', titleWidth),
      cell('COMPANY', companyWidth),
      cell('SUBMITTED BY', ownerWidth),
      cell('SCHEDULED', scheduledWidth),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = items.map((item) => {
    const overdue = item.releaseAt ? item.releaseAt.getTime() < Date.now() : false
    const flags: string[] = []
    if (item.editorialHold) flags.push(color.red('hold'))
    if (item.checkedout && item.editorName) flags.push(color.violet(`✎ ${item.editorName}`))

    const line =
      ' ' +
      [
        cell(item.title || `Release #${item.releaseId}`, titleWidth, { paint: color.text }),
        cell(item.companyName, companyWidth, { paint: color.muted }),
        cell(item.ownerEmail, ownerWidth, { paint: color.muted }),
        cell(formatCountdown(item.releaseAt), scheduledWidth, {
          paint: overdue ? color.red : color.yellow,
        }),
      ].join(' ')

    if (flags.length === 0) return [line]
    return [line, ' ' + ' '.repeat(2) + dim(flags.join(dim(color.faint(' · '))))]
  })

  return [BLANK, header, ...rows.flat(), BLANK]
}

export function signupsBody(signups: RecentSignup[], width: number): string[] {
  const inner = width - 2
  if (signups.length === 0) {
    return [BLANK, ` ${dim(color.faint('No registrations recorded.'))}`, BLANK]
  }

  const whenWidth = 17
  const idWidth = 6
  const emailWidth = 30
  const nameWidth = 20
  const gaps = 4
  const companyWidth = Math.max(
    10,
    inner - 1 - whenWidth - idWidth - emailWidth - nameWidth - gaps,
  )

  const header =
    ' ' +
    [
      cell('REGISTERED', whenWidth),
      cell('ID', idWidth, { align: 'right' }),
      cell('EMAIL', emailWidth),
      cell('NAME', nameWidth),
      cell('COMPANY', companyWidth),
    ]
      .map((text) => dim(color.faint(text)))
      .join(' ')

  const rows = signups.map((signup) => {
    const name = [signup.firstName, signup.lastName].filter(Boolean).join(' ')
    const verified = signup.emailVerified
    return (
      ' ' +
      [
        cell(formatRelativeDay(signup.createdAt), whenWidth, {
          paint: verified ? color.muted : color.amber,
        }),
        cell(String(signup.id), idWidth, { align: 'right', paint: color.faint }),
        cell(signup.email, emailWidth, { paint: verified ? color.text : color.amber }),
        cell(name || '—', nameWidth, { paint: color.muted }),
        cell(signup.companies.join(', ') || '—', companyWidth, { paint: color.muted }),
      ].join(' ')
    )
  })

  const unverified = signups.filter((signup) => !signup.emailVerified).length
  const footer =
    unverified > 0
      ? [` ${dim(color.amber(`${unverified} of these have not verified their email yet.`))}`]
      : []

  return [BLANK, header, ...rows, ...footer, BLANK]
}

export function favoritesBody(favorites: FavoriteUser[], width: number): string[] {
  const inner = width - 2
  if (favorites.length === 0) {
    return [BLANK, ` ${dim(color.faint('No favorited users.'))}`, BLANK]
  }

  const perRow = inner >= 108 ? 3 : inner >= 76 ? 2 : 1
  const widths = splitWidth(inner - 1, perRow, 2)
  const blocks: string[] = []

  for (let index = 0; index < favorites.length; index += perRow) {
    const chunk = favorites.slice(index, index + perRow)
    const cells = chunk.map((user, position) => {
      const size = widths[position]
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ')
      const primary = fullName || user.email
      const secondary = fullName ? user.email : `ID ${user.id}`
      const pending = user.emailVerified ? '' : ' · pending'
      return [
        ` ${color.yellow('★')} ${color.text(truncate(primary, size - 4))}`,
        `   ${dim(color.faint(truncate(secondary + pending, size - 4)))}`,
      ]
    })
    while (cells.length < perRow) cells.push(['', ''])
    blocks.push(...columns(cells, widths, 2))
  }

  return [BLANK, ...blocks, BLANK]
}

export function pendingBanner(stats: PlatformStats | null, width: number): string[] {
  if (!stats) return []
  const notes: string[] = []
  if (stats.pendingReleases > 0) {
    notes.push(`${plural(stats.pendingReleases, 'release')} pending editorial review`)
  }
  if (stats.pendingApprovals > 0) {
    notes.push(`${plural(stats.pendingApprovals, 'release')} awaiting stakeholder approval`)
  }
  if (notes.length === 0) return []
  const text = notes.join(' · ')
  return [
    ' ' +
      color.yellow('▲ ') +
      bold(color.yellow(truncate(text, width - 6))),
  ]
}

/** Small right-aligned note for a panel's top border. */
export function freshness(fetchedAt: number | null, loading: boolean, spin: string): string {
  if (loading) return `${spin} refreshing`
  return `updated ${formatAge(fetchedAt)}`
}

/** One-line roll-up shown under the header. */
export function summaryLine(db: DbSnapshot | null, sales: SalesSnapshot | null): string {
  const parts: string[] = []
  if (sales) parts.push(`${color.green('today')} ${bold(formatCents(sales.today.amount))}`)
  if (sales) parts.push(`${color.amber('mtd')} ${bold(formatCents(sales.mtd.amount))}`)
  if (db) parts.push(`${color.blue('users')} ${bold(db.stats.users.toLocaleString('en-US'))}`)
  if (db) parts.push(`${color.violet('queue')} ${bold(String(db.stats.pendingReleases))}`)
  if (db && db.stats.pendingApprovals > 0) {
    parts.push(`${color.cyan('approvals')} ${bold(String(db.stats.pendingApprovals))}`)
  }
  if (parts.length === 0) return ''
  return ' ' + parts.join(dim(color.faint('  │  ')))
}
