import { auth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function toEpoch(d: Date): number {
  return Math.floor(d.getTime() / 1000)
}

function getStartOfDay(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

function getYesterday(): { gte: number; lt: number } {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 1)
  return { gte: toEpoch(start), lt: toEpoch(end) }
}

function getStartOfWeek(): number {
  const now = new Date()
  const day = now.getDay() // 0=Sun
  now.setDate(now.getDate() - day)
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

function getLastWeek(): { gte: number; lt: number } {
  const now = new Date()
  const day = now.getDay()
  const thisWeekStart = new Date(now)
  thisWeekStart.setDate(thisWeekStart.getDate() - day)
  thisWeekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  return { gte: toEpoch(lastWeekStart), lt: toEpoch(thisWeekStart) }
}

function getStartOfMonth(): number {
  const now = new Date()
  now.setDate(1)
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

function getLastMonth(): { gte: number; lt: number } {
  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { gte: toEpoch(lastMonthStart), lt: toEpoch(thisMonthStart) }
}

function getStartOfYear(): number {
  const now = new Date()
  now.setMonth(0, 1)
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

function getLastYear(): { gte: number; lt: number } {
  const now = new Date()
  const thisYearStart = new Date(now.getFullYear(), 0, 1)
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
  return { gte: toEpoch(lastYearStart), lt: toEpoch(thisYearStart) }
}

interface SalesPeriod { amount: number; count: number }

const IGNORED_INVOICE_NUMBERS = new Set(['KDJFGKMM-0001'])

function addPeriods(a: SalesPeriod, b: SalesPeriod): SalesPeriod {
  return { amount: a.amount + b.amount, count: a.count + b.count }
}

async function getChargesTotal(stripe: Stripe, createdGte: number, createdLt?: number): Promise<SalesPeriod> {
  let amount = 0
  let count = 0
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const created: Stripe.RangeQueryParam = { gte: createdGte }
    if (createdLt) created.lt = createdLt
    const params: Stripe.ChargeListParams = {
      created,
      limit: 100,
    }
    if (startingAfter) params.starting_after = startingAfter

    const charges = await stripe.charges.list(params)

    for (const charge of charges.data) {
      if (charge.paid && !charge.refunded && charge.status === 'succeeded') {
        amount += charge.amount - (charge.amount_refunded || 0)
        count++
      }
    }

    hasMore = charges.has_more
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id
    }
  }

  return { amount, count }
}

/** Individual succeeded charge amounts (net of refunds) for time-series bucketing. */
async function listChargeEvents(
  stripe: Stripe,
  createdGte: number,
): Promise<Array<{ at: number; amount: number }>> {
  const events: Array<{ at: number; amount: number }> = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const params: Stripe.ChargeListParams = {
      created: { gte: createdGte },
      limit: 100,
    }
    if (startingAfter) params.starting_after = startingAfter

    const charges = await stripe.charges.list(params)

    for (const charge of charges.data) {
      if (charge.paid && !charge.refunded && charge.status === 'succeeded') {
        events.push({
          at: charge.created,
          amount: charge.amount - (charge.amount_refunded || 0),
        })
      }
    }

    hasMore = charges.has_more
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id
    }
  }

  return events
}

function localDayKey(epoch: number): string {
  const d = new Date(epoch * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface DailySalesPoint {
  date: string
  label: string
  amount: number
  count: number
}

function buildDailySeries(
  events: Array<{ at: number; amount: number }>,
  days: number,
): DailySalesPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const points: DailySalesPoint[] = []
  const indexByDate = new Map<string, number>()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const date = localDayKey(toEpoch(d))
    indexByDate.set(date, points.length)
    points.push({
      date,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: 0,
      count: 0,
    })
  }

  const startEpoch = toEpoch(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1)),
  )

  for (const ev of events) {
    if (ev.at < startEpoch) continue
    const idx = indexByDate.get(localDayKey(ev.at))
    if (idx == null) continue
    points[idx].amount += ev.amount
    points[idx].count += 1
  }

  return points
}

/**
 * Amount on a paid invoice that was recorded outside Stripe (manual / out-of-band).
 * Requires `payments` to be expanded — without it we return 0 to avoid double-counting
 * invoices that already appear as Charges.
 */
function getOutOfBandPaidAmount(inv: Stripe.Invoice): number {
  if (inv.status !== 'paid' || !inv.amount_paid) return 0
  if (!inv.payments || !Array.isArray(inv.payments.data)) return 0

  const viaStripe = inv.payments.data
    .filter(
      (p) =>
        p.status === 'paid' &&
        (p.payment.type === 'payment_intent' || p.payment.type === 'charge'),
    )
    .reduce((sum, p) => sum + (p.amount_paid ?? 0), 0)

  return Math.max(0, inv.amount_paid - viaStripe)
}

/** Paid out-of-band invoice amounts, keyed by status_transitions.paid_at. */
async function listOutOfBandPayments(
  stripe: Stripe,
  createdGte: number,
): Promise<Array<{ paidAt: number; amount: number }>> {
  const items: Array<{ paidAt: number; amount: number }> = []
  let hasMore = true
  let startingAfter: string | undefined

  while (hasMore) {
    const params: Stripe.InvoiceListParams = {
      status: 'paid',
      created: { gte: createdGte },
      limit: 100,
      expand: ['data.payments'],
    }
    if (startingAfter) params.starting_after = startingAfter

    const result = await stripe.invoices.list(params)

    for (const inv of result.data) {
      if (inv.number && IGNORED_INVOICE_NUMBERS.has(inv.number)) continue
      const amount = getOutOfBandPaidAmount(inv)
      if (amount <= 0) continue
      const paidAt = inv.status_transitions?.paid_at ?? inv.created
      items.push({ paidAt, amount })
    }

    hasMore = result.has_more
    if (result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id
    }
  }

  return items
}

function sumOutOfBandInRange(
  items: Array<{ paidAt: number; amount: number }>,
  paidGte: number,
  paidLt?: number,
): SalesPeriod {
  let amount = 0
  let count = 0
  for (const item of items) {
    if (item.paidAt < paidGte) continue
    if (paidLt != null && item.paidAt >= paidLt) continue
    amount += item.amount
    count++
  }
  return { amount, count }
}

// --- Server-side cache ---
interface SalesCache {
  current: {
    today: SalesPeriod
    wtd: SalesPeriod
    mtd: SalesPeriod
    ytd: SalesPeriod
    series: DailySalesPoint[]
    invoices: any[]
    fetchedAt: number
  } | null
  prev: {
    prevToday: SalesPeriod
    prevWtd: SalesPeriod
    prevMtd: SalesPeriod
    prevYtd: SalesPeriod
    date: string // YYYY-MM-DD
  } | null
}

const cache: SalesCache = { current: null, prev: null }
const CURRENT_TTL = 2 * 60 * 60 * 1000 // 2 hours

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

async function getOutstandingInvoices(stripe: Stripe) {
  const invoices: Array<{
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
  }> = []

  let hasMore = true
  let startingAfter: string | undefined

  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)

  while (hasMore) {
    const params: Stripe.InvoiceListParams = {
      status: 'open',
      limit: 100,
      created: { gte: thirtyDaysAgo },
    }
    if (startingAfter) params.starting_after = startingAfter

    const result = await stripe.invoices.list(params)

    for (const inv of result.data) {
      if (inv.number && IGNORED_INVOICE_NUMBERS.has(inv.number)) continue
      invoices.push({
        id: inv.id,
        number: inv.number,
        customerEmail: inv.customer_email,
        customerName: inv.customer_name,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        amountRemaining: inv.amount_remaining,
        status: inv.status,
        dueDate: inv.due_date,
        created: inv.created,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      })
    }

    hasMore = result.has_more
    if (result.data.length > 0) {
      startingAfter = result.data[result.data.length - 1].id
    }
  }

  return invoices
}

export async function GET(request: NextRequest) {
  const session = await auth()
  const isAdmin = (session?.user as any)?.isAdmin
  const isStaff = (session?.user as any)?.isStaff

  if (!isAdmin && !isStaff) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stripeKey = process.env.STRIPE_SECRET
  if (!stripeKey) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-12-15.clover' })
    const now = Date.now()
    const todayDate = getTodayDate()

    const needCurrent =
      !cache.current ||
      !cache.current.series ||
      refresh ||
      now - cache.current.fetchedAt > CURRENT_TTL
    const needPrev = !cache.prev || cache.prev.date !== todayDate

    // Out-of-band invoice payments (no Charge) — fetch once when either cache misses
    let oobItems: Array<{ paidAt: number; amount: number }> | null = null
    if (needCurrent || needPrev) {
      // Look back far enough that invoices created earlier can still land in last-year buckets
      const oobCreatedGte = getLastYear().gte - 365 * 24 * 60 * 60
      oobItems = await listOutOfBandPayments(stripe, oobCreatedGte)
    }

    // Current periods: use cache if within TTL and not a forced refresh
    let current = cache.current
    if (needCurrent) {
      const seriesDays = 90
      const seriesStart = (() => {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - (seriesDays - 1))
        return toEpoch(d)
      })()

      const [todayCharges, wtdCharges, mtdCharges, ytdCharges, openInvoices, chargeEvents] =
        await Promise.all([
          getChargesTotal(stripe, getStartOfDay()),
          getChargesTotal(stripe, getStartOfWeek()),
          getChargesTotal(stripe, getStartOfMonth()),
          getChargesTotal(stripe, getStartOfYear()),
          getOutstandingInvoices(stripe),
          listChargeEvents(stripe, seriesStart),
        ])

      const oob = oobItems!
      const seriesEvents = [
        ...chargeEvents,
        ...oob.map((item) => ({ at: item.paidAt, amount: item.amount })),
      ]

      current = {
        today: addPeriods(todayCharges, sumOutOfBandInRange(oob, getStartOfDay())),
        wtd: addPeriods(wtdCharges, sumOutOfBandInRange(oob, getStartOfWeek())),
        mtd: addPeriods(mtdCharges, sumOutOfBandInRange(oob, getStartOfMonth())),
        ytd: addPeriods(ytdCharges, sumOutOfBandInRange(oob, getStartOfYear())),
        series: buildDailySeries(seriesEvents, seriesDays),
        invoices: openInvoices,
        fetchedAt: now,
      }
      cache.current = current
    }

    // Previous periods: cached for the entire day, never changes
    let prev = cache.prev
    if (needPrev) {
      const prevDay = getYesterday()
      const prevWeek = getLastWeek()
      const prevMonth = getLastMonth()
      const prevYear = getLastYear()

      const [prevTodayCharges, prevWtdCharges, prevMtdCharges, prevYtdCharges] =
        await Promise.all([
          getChargesTotal(stripe, prevDay.gte, prevDay.lt),
          getChargesTotal(stripe, prevWeek.gte, prevWeek.lt),
          getChargesTotal(stripe, prevMonth.gte, prevMonth.lt),
          getChargesTotal(stripe, prevYear.gte, prevYear.lt),
        ])

      const oob = oobItems!
      prev = {
        prevToday: addPeriods(
          prevTodayCharges,
          sumOutOfBandInRange(oob, prevDay.gte, prevDay.lt),
        ),
        prevWtd: addPeriods(
          prevWtdCharges,
          sumOutOfBandInRange(oob, prevWeek.gte, prevWeek.lt),
        ),
        prevMtd: addPeriods(
          prevMtdCharges,
          sumOutOfBandInRange(oob, prevMonth.gte, prevMonth.lt),
        ),
        prevYtd: addPeriods(
          prevYtdCharges,
          sumOutOfBandInRange(oob, prevYear.gte, prevYear.lt),
        ),
        date: todayDate,
      }
      cache.prev = prev
    }

    return NextResponse.json({
      today: current!.today,
      wtd: current!.wtd,
      mtd: current!.mtd,
      ytd: current!.ytd,
      series: current!.series,
      invoices: current!.invoices,
      prevToday: prev!.prevToday,
      prevWtd: prev!.prevWtd,
      prevMtd: prev!.prevMtd,
      prevYtd: prev!.prevYtd,
      cachedAt: current!.fetchedAt,
    })
  } catch (error) {
    console.error('Error fetching sales data:', error)
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 })
  }
}
