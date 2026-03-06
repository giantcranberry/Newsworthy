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

async function getChargesTotal(stripe: Stripe, createdGte: number, createdLt?: number): Promise<{ amount: number; count: number }> {
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

// --- Server-side cache ---
interface SalesPeriod { amount: number; count: number }

interface SalesCache {
  current: {
    today: SalesPeriod
    wtd: SalesPeriod
    mtd: SalesPeriod
    ytd: SalesPeriod
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

const IGNORED_INVOICE_NUMBERS = new Set(['KDJFGKMM-0001'])

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

    // Current periods: use cache if within TTL and not a forced refresh
    let current = cache.current
    if (!current || refresh || now - current.fetchedAt > CURRENT_TTL) {
      const [today, wtd, mtd, ytd, openInvoices] = await Promise.all([
        getChargesTotal(stripe, getStartOfDay()),
        getChargesTotal(stripe, getStartOfWeek()),
        getChargesTotal(stripe, getStartOfMonth()),
        getChargesTotal(stripe, getStartOfYear()),
        getOutstandingInvoices(stripe),
      ])
      current = { today, wtd, mtd, ytd, invoices: openInvoices, fetchedAt: now }
      cache.current = current
    }

    // Previous periods: cached for the entire day, never changes
    let prev = cache.prev
    if (!prev || prev.date !== todayDate) {
      const prevDay = getYesterday()
      const prevWeek = getLastWeek()
      const prevMonth = getLastMonth()
      const prevYear = getLastYear()

      const [prevToday, prevWtd, prevMtd, prevYtd] = await Promise.all([
        getChargesTotal(stripe, prevDay.gte, prevDay.lt),
        getChargesTotal(stripe, prevWeek.gte, prevWeek.lt),
        getChargesTotal(stripe, prevMonth.gte, prevMonth.lt),
        getChargesTotal(stripe, prevYear.gte, prevYear.lt),
      ])
      prev = { prevToday, prevWtd, prevMtd, prevYtd, date: todayDate }
      cache.prev = prev
    }

    return NextResponse.json({
      today: current.today,
      wtd: current.wtd,
      mtd: current.mtd,
      ytd: current.ytd,
      invoices: current.invoices,
      prevToday: prev.prevToday,
      prevWtd: prev.prevWtd,
      prevMtd: prev.prevMtd,
      prevYtd: prev.prevYtd,
      cachedAt: current.fetchedAt,
    })
  } catch (error) {
    console.error('Error fetching sales data:', error)
    return NextResponse.json({ error: 'Failed to fetch sales data' }, { status: 500 })
  }
}
