/** Number, money and date formatting shared by every panel. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

/** Mirrors the dashboard's formatCents: cents in, "$1,234.56" out. */
export function formatCents(cents: number): string {
  return currency.format(cents / 100)
}

/** Short money for tight columns: $0, $940, $12.4k, $1.31M */
export function formatCompactCents(cents: number): string {
  const dollars = cents / 100
  const abs = Math.abs(dollars)
  if (abs >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`
  if (abs >= 10_000) return `$${(dollars / 1000).toFixed(1)}k`
  if (abs >= 1000) return `$${(dollars / 1000).toFixed(2)}k`
  return `$${Math.round(dollars).toLocaleString('en-US')}`
}

/** Stripe timestamps are epoch seconds. */
export function formatEpochDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** Time of day for a Stripe timestamp, e.g. "3:42 PM". */
export function formatEpochTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** "just now", "42s ago", "6m ago", "2h ago" */
export function formatAge(ms: number | null): string {
  if (!ms) return 'never'
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000))
  if (seconds < 3) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Duration until (positive) or since (negative) a future date. */
export function formatCountdown(date: Date | null | undefined): string {
  if (!date) return '—'
  const diff = date.getTime() - Date.now()
  const past = diff < 0
  let seconds = Math.round(Math.abs(diff) / 1000)
  const days = Math.floor(seconds / 86400)
  seconds -= days * 86400
  const hours = Math.floor(seconds / 3600)
  seconds -= hours * 3600
  const minutes = Math.floor(seconds / 60)

  let text: string
  if (days > 0) text = `${days}d ${hours}h`
  else if (hours > 0) text = `${hours}h ${minutes}m`
  else text = `${minutes}m`

  return past ? `${text} overdue` : `in ${text}`
}

/** "2h ago", "Yesterday 14:05", "Sep 4 11:47" — recent dates read as relative. */
export function formatRelativeDay(date: Date | null | undefined): string {
  if (!date) return '—'
  const elapsed = Date.now() - date.getTime()
  if (elapsed < 0) return formatDateTime(date)
  if (elapsed < 60 * 60 * 1000) return `${Math.max(1, Math.round(elapsed / 60000))}m ago`
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.round(elapsed / 3600000)}h ago`

  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (elapsed < 48 * 60 * 60 * 1000) return `Yesterday ${time}`
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`
}

export function plural(n: number, word: string, suffix = 's'): string {
  return `${n} ${word}${n === 1 ? '' : suffix}`
}

export interface Delta {
  /** e.g. "+18.4%" — empty when the previous period was zero. */
  text: string
  direction: 'up' | 'down' | 'flat'
}

export function delta(current: number, previous: number): Delta {
  if (previous === 0) {
    if (current === 0) return { text: '—', direction: 'flat' }
    return { text: 'new', direction: 'up' }
  }
  const change = ((current - previous) / previous) * 100
  const direction = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat'
  const sign = change > 0 ? '+' : ''
  return { text: `${sign}${change.toFixed(1)}%`, direction }
}
