/**
 * Local-time period boundaries as epoch seconds. These match the boundaries
 * used by `apps/dashboard/src/app/api/admin/sales/route.ts` so the TUI buckets
 * revenue exactly the way the dashboard does.
 */

export interface Range {
  gte: number
  lt?: number
}

export const toEpoch = (date: Date): number => Math.floor(date.getTime() / 1000)

export function startOfDay(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

export function yesterday(): Range {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 1)
  return { gte: toEpoch(start), lt: toEpoch(end) }
}

export function startOfWeek(): number {
  const now = new Date()
  now.setDate(now.getDate() - now.getDay()) // week starts Sunday
  now.setHours(0, 0, 0, 0)
  return toEpoch(now)
}

export function lastWeek(): Range {
  const thisWeekStart = new Date()
  thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay())
  thisWeekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  return { gte: toEpoch(lastWeekStart), lt: toEpoch(thisWeekStart) }
}

export function startOfMonth(): number {
  const now = new Date()
  return toEpoch(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function lastMonth(): Range {
  const now = new Date()
  return {
    gte: toEpoch(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    lt: toEpoch(new Date(now.getFullYear(), now.getMonth(), 1)),
  }
}

export function startOfYear(): number {
  const now = new Date()
  return toEpoch(new Date(now.getFullYear(), 0, 1))
}

export function lastYear(): Range {
  const now = new Date()
  return {
    gte: toEpoch(new Date(now.getFullYear() - 1, 0, 1)),
    lt: toEpoch(new Date(now.getFullYear(), 0, 1)),
  }
}

/** Local YYYY-MM-DD key for an epoch-second timestamp. */
export function localDayKey(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
