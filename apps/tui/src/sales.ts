/**
 * Live Stripe revenue, ported from the admin dashboard's /api/admin/sales route.
 *
 * The web route recomputes everything from Stripe on a 2-hour cache. A TUI that
 * refreshes every couple of minutes cannot afford that, so this keeps the raw
 * charge and out-of-band-payment events in memory and only pulls the recent
 * window on each poll. Every period total is then summed locally, which makes
 * the refresh cheap and the numbers update within seconds of a payment.
 *
 * Refunds and late payments on older records only show up on a full rebuild,
 * which happens on startup, on demand (`R`), and every 30 minutes.
 */

import Stripe from 'stripe'
import {
  lastMonth,
  lastWeek,
  lastYear,
  localDayKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  toEpoch,
  yesterday,
  type Range,
} from './periods.ts'

const STRIPE_API_VERSION = '2025-12-15.clover'

/** Kept in sync with the sales API route. */
const IGNORED_INVOICE_NUMBERS = new Set(['KDJFGKMM-0001'])

const DAY = 24 * 60 * 60
export const SERIES_DAYS = 90

/** Re-pull this far back on every incremental poll to catch clock skew. */
const INCREMENTAL_OVERLAP = 30 * 60
/** Invoices created inside this window are re-checked for new payments. */
const INVOICE_RECHECK_DAYS = 45
/** How stale the in-memory event store may get before a full rebuild. */
export const FULL_REBUILD_MS = 30 * 60 * 1000

export interface SalesPeriod {
  amount: number
  count: number
  /** Share of `amount` paid outside Stripe. Already included in the total. */
  oobAmount: number
  oobCount: number
}

export interface DailySalesPoint {
  date: string
  label: string
  amount: number
  count: number
  /** Share of `amount` paid outside Stripe. Already included in the total. */
  oobAmount: number
  oobCount: number
}

/** One payment on today's list, with a deep link into the Stripe dashboard. */
export interface Transaction {
  id: string
  at: number
  amount: number
  kind: RevenueKind
  /** Who paid. Many charges carry no name or email at all. */
  label: string | null
  /** What was bought: a charge description, or an invoice number. */
  reference: string | null
  url: string
}

export interface OpenInvoice {
  id: string
  number: string | null
  customerEmail: string | null
  customerName: string | null
  amountDue: number
  amountPaid: number
  amountRemaining: number
  status: string | null
  dueDate: number | null
  created: number
  hostedInvoiceUrl: string | null
}

export interface SalesSnapshot {
  today: SalesPeriod
  wtd: SalesPeriod
  mtd: SalesPeriod
  ytd: SalesPeriod
  prevToday: SalesPeriod
  prevWtd: SalesPeriod
  prevMtd: SalesPeriod
  prevYtd: SalesPeriod
  series: DailySalesPoint[]
  todayTransactions: Transaction[]
  invoices: OpenInvoice[]
  fetchedAt: number
  fullRebuildAt: number
}

/** Where the money came in: a Stripe charge, or a payment recorded manually. */
export type RevenueKind = 'charge' | 'oob'

interface RevenueEvent {
  at: number
  amount: number
  kind: RevenueKind
}

interface ChargeEvent {
  created: number
  amount: number
  /** Who paid, as far as the charge itself knows. Often nothing. */
  label: string | null
  reference: string | null
}

interface OutOfBandEvent {
  created: number
  paidAt: number
  amount: number
  label: string | null
  reference: string | null
}

/**
 * Amount on a paid invoice recorded outside Stripe (manual / out-of-band).
 * Needs `payments` expanded; without it we return 0 so invoices that already
 * appear as charges are not double counted.
 */
function outOfBandPaidAmount(invoice: Stripe.Invoice): number {
  if (invoice.status !== 'paid' || !invoice.amount_paid) return 0
  if (!invoice.payments || !Array.isArray(invoice.payments.data)) return 0

  const viaStripe = invoice.payments.data
    .filter(
      (payment) =>
        payment.status === 'paid' &&
        (payment.payment.type === 'payment_intent' || payment.payment.type === 'charge'),
    )
    .reduce((total, payment) => total + (payment.amount_paid ?? 0), 0)

  return Math.max(0, invoice.amount_paid - viaStripe)
}

/** Charge descriptions end with the release's uuid, which reads as noise. */
function cleanDescription(description: string | null | undefined): string | null {
  if (!description) return null
  return description.replace(/\s*\([0-9a-f]{32}\)\s*$/i, '').trim() || null
}

function sumRange(events: Iterable<RevenueEvent>, range: Range): SalesPeriod {
  let amount = 0
  let count = 0
  let oobAmount = 0
  let oobCount = 0
  for (const event of events) {
    if (event.at < range.gte) continue
    if (range.lt != null && event.at >= range.lt) continue
    amount += event.amount
    count += 1
    if (event.kind === 'oob') {
      oobAmount += event.amount
      oobCount += 1
    }
  }
  return { amount, count, oobAmount, oobCount }
}

function buildSeries(events: RevenueEvent[], days: number): DailySalesPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const points: DailySalesPoint[] = []
  const indexByDate = new Map<string, number>()

  for (let back = days - 1; back >= 0; back--) {
    const date = new Date(today)
    date.setDate(date.getDate() - back)
    const key = localDayKey(toEpoch(date))
    indexByDate.set(key, points.length)
    points.push({
      date: key,
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: 0,
      count: 0,
      oobAmount: 0,
      oobCount: 0,
    })
  }

  for (const event of events) {
    const index = indexByDate.get(localDayKey(event.at))
    if (index == null) continue
    points[index].amount += event.amount
    points[index].count += 1
    if (event.kind === 'oob') {
      points[index].oobAmount += event.amount
      points[index].oobCount += 1
    }
  }

  return points
}

export class SalesStore {
  private readonly stripe: Stripe
  /** Test-mode keys deep-link into the dashboard's /test tree. */
  private readonly dashboardBase: string
  /** Succeeded, unrefunded charges keyed by charge id. */
  private charges = new Map<string, ChargeEvent>()
  /** Paid-outside-Stripe invoice amounts keyed by invoice id. */
  private outOfBand = new Map<string, OutOfBandEvent>()
  private invoices: OpenInvoice[] = []
  private fullRebuildAt = 0
  private fetchedAt = 0

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
    this.dashboardBase = secretKey.includes('_test_')
      ? 'https://dashboard.stripe.com/test'
      : 'https://dashboard.stripe.com'
  }

  get lastFullRebuildAt(): number {
    return this.fullRebuildAt
  }

  /**
   * Pull the newest Stripe data and return a complete snapshot.
   * Set `full` to rebuild the whole event store from scratch.
   */
  async refresh(options: { full?: boolean } = {}): Promise<SalesSnapshot> {
    const needsFullRebuild =
      options.full ||
      this.fullRebuildAt === 0 ||
      Date.now() - this.fullRebuildAt > FULL_REBUILD_MS

    // Last year's start is the earliest boundary any period card needs.
    const chargeAnchor = lastYear().gte
    const chargesFrom = needsFullRebuild
      ? chargeAnchor
      : Math.max(chargeAnchor, this.fetchedAt / 1000 - INCREMENTAL_OVERLAP)

    // Invoices created before the window can still be paid inside it, so the
    // full rebuild looks a year further back than the charge anchor.
    const invoicesFrom = needsFullRebuild
      ? chargeAnchor - 365 * DAY
      : Math.floor(Date.now() / 1000) - INVOICE_RECHECK_DAYS * DAY

    const [charges, paidInvoices, openInvoices] = await Promise.all([
      this.listCharges(chargesFrom),
      this.listOutOfBandPayments(invoicesFrom),
      this.listOpenInvoices(),
    ])

    if (needsFullRebuild) {
      this.charges = charges
      this.outOfBand = paidInvoices
      this.fullRebuildAt = Date.now()
    } else {
      // Replace the refetched window wholesale so refunds inside it drop out.
      mergeWindow(this.charges, charges, chargesFrom, (event) => event.created)
      mergeWindow(this.outOfBand, paidInvoices, invoicesFrom, (event) => event.created)
    }

    this.invoices = openInvoices
    this.fetchedAt = Date.now()

    return this.snapshot()
  }

  /** Recompute every period card and the daily series from the event store. */
  snapshot(): SalesSnapshot {
    // Out-of-band payments count towards every total alongside card charges;
    // the kind tag only exists so the chart can show where the money came in.
    const chargeEvents: RevenueEvent[] = [...this.charges.values()].map((event) => ({
      at: event.created,
      amount: event.amount,
      kind: 'charge',
    }))
    const oobEvents: RevenueEvent[] = [...this.outOfBand.values()].map((event) => ({
      at: event.paidAt,
      amount: event.amount,
      kind: 'oob',
    }))
    const all: RevenueEvent[] = [...chargeEvents, ...oobEvents]

    const seriesStart = (() => {
      const date = new Date()
      date.setHours(0, 0, 0, 0)
      date.setDate(date.getDate() - (SERIES_DAYS - 1))
      return toEpoch(date)
    })()

    const dayStart = startOfDay()
    const todayTransactions: Transaction[] = [
      ...[...this.charges.entries()]
        .filter(([, event]) => event.created >= dayStart)
        .map(([id, event]) => ({
          id,
          at: event.created,
          amount: event.amount,
          kind: 'charge' as const,
          label: event.label,
          reference: event.reference,
          url: `${this.dashboardBase}/payments/${id}`,
        })),
      ...[...this.outOfBand.entries()]
        .filter(([, event]) => event.paidAt >= dayStart)
        .map(([id, event]) => ({
          id,
          at: event.paidAt,
          amount: event.amount,
          kind: 'oob' as const,
          label: event.label,
          reference: event.reference,
          url: `${this.dashboardBase}/invoices/${id}`,
        })),
    ].sort((a, b) => b.at - a.at)

    return {
      today: sumRange(all, { gte: dayStart }),
      wtd: sumRange(all, { gte: startOfWeek() }),
      mtd: sumRange(all, { gte: startOfMonth() }),
      ytd: sumRange(all, { gte: startOfYear() }),
      prevToday: sumRange(all, yesterday()),
      prevWtd: sumRange(all, lastWeek()),
      prevMtd: sumRange(all, lastMonth()),
      prevYtd: sumRange(all, lastYear()),
      series: buildSeries(
        all.filter((event) => event.at >= seriesStart),
        SERIES_DAYS,
      ),
      todayTransactions,
      invoices: this.invoices,
      fetchedAt: this.fetchedAt,
      fullRebuildAt: this.fullRebuildAt,
    }
  }

  private async listCharges(createdGte: number): Promise<Map<string, ChargeEvent>> {
    const result = new Map<string, ChargeEvent>()
    let startingAfter: string | undefined

    while (true) {
      const params: Stripe.ChargeListParams = {
        created: { gte: Math.floor(createdGte) },
        limit: 100,
      }
      if (startingAfter) params.starting_after = startingAfter

      const page = await this.stripe.charges.list(params)

      for (const charge of page.data) {
        if (!charge.paid || charge.refunded || charge.status !== 'succeeded') continue
        result.set(charge.id, {
          created: charge.created,
          amount: charge.amount - (charge.amount_refunded || 0),
          label:
            charge.billing_details?.name ||
            charge.billing_details?.email ||
            charge.receipt_email ||
            null,
          reference: cleanDescription(charge.description),
        })
      }

      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }

    return result
  }

  private async listOutOfBandPayments(
    createdGte: number,
  ): Promise<Map<string, OutOfBandEvent>> {
    const result = new Map<string, OutOfBandEvent>()
    let startingAfter: string | undefined

    while (true) {
      const params: Stripe.InvoiceListParams = {
        status: 'paid',
        created: { gte: Math.floor(createdGte) },
        limit: 100,
        expand: ['data.payments'],
      }
      if (startingAfter) params.starting_after = startingAfter

      const page = await this.stripe.invoices.list(params)

      for (const invoice of page.data) {
        if (!invoice.id) continue
        if (invoice.number && IGNORED_INVOICE_NUMBERS.has(invoice.number)) continue
        const amount = outOfBandPaidAmount(invoice)
        if (amount <= 0) continue
        result.set(invoice.id, {
          created: invoice.created,
          paidAt: invoice.status_transitions?.paid_at ?? invoice.created,
          amount,
          label: invoice.customer_name || invoice.customer_email || null,
          reference: invoice.number ?? null,
        })
      }

      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }

    return result
  }

  /** Open invoices from the last 30 days, same window as the dashboard. */
  private async listOpenInvoices(): Promise<OpenInvoice[]> {
    const invoices: OpenInvoice[] = []
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * DAY
    let startingAfter: string | undefined

    while (true) {
      const params: Stripe.InvoiceListParams = {
        status: 'open',
        limit: 100,
        created: { gte: thirtyDaysAgo },
      }
      if (startingAfter) params.starting_after = startingAfter

      const page = await this.stripe.invoices.list(params)

      for (const invoice of page.data) {
        if (!invoice.id) continue
        if (invoice.number && IGNORED_INVOICE_NUMBERS.has(invoice.number)) continue
        invoices.push({
          id: invoice.id,
          number: invoice.number,
          customerEmail: invoice.customer_email,
          customerName: invoice.customer_name,
          amountDue: invoice.amount_due,
          amountPaid: invoice.amount_paid,
          amountRemaining: invoice.amount_remaining,
          status: invoice.status,
          dueDate: invoice.due_date,
          created: invoice.created,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
        })
      }

      if (!page.has_more || page.data.length === 0) break
      startingAfter = page.data[page.data.length - 1].id
    }

    invoices.sort((a, b) => b.created - a.created)
    return invoices
  }
}

/** Drop everything at or after `from`, then take the freshly fetched entries. */
function mergeWindow<T>(
  target: Map<string, T>,
  incoming: Map<string, T>,
  from: number,
  timeOf: (entry: T) => number,
): void {
  for (const [key, entry] of target) {
    if (timeOf(entry) >= from) target.delete(key)
  }
  for (const [key, entry] of incoming) {
    target.set(key, entry)
  }
}
